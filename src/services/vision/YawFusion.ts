/**
 * YawFusion — the pure layer between a PerceptionBackend and the pure
 * detectScans. It is the ONLY module that knows about landmarks / world coords /
 * visibility, and it collapses them to the single `yawDeg + confidence` scalar
 * the detector consumes. This is where intelligence grows over time (hip
 * rotation, gaze, multi-signal fusion) — all behind the same output shape, so
 * detectScans never changes. See docs/perception-architecture.md §4.
 *
 * Pure + dependency-free (types only) so it is fully unit-testable with no
 * camera, native module, or device.
 */

import type { Landmark3D, RawPoseFrame } from './PerceptionBackend';
import type { CalibrationProfile } from './types';

// MediaPipe BlazePose landmark indices.
const NOSE = 0;
const L_EYE = 2;
const R_EYE = 5;
const MOUTH_L = 9;
const MOUTH_R = 10;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;

/** One frame mapped onto the player's yaw axis (clock not yet normalized). */
export interface FusedReading {
  /** Echoed native capture clock; the verifier maps this onto the drill clock. */
  captureClockMs: number;
  /** Player-frame yaw (baseline-subtracted, sign-flipped): `< 0` ⇒ player left. */
  yawDeg: number;
  /** Min shoulder visibility — the occlusion-robust confidence. */
  confidence: number;
  /** Absolute torso yaw before baseline/sign. */
  torsoYawDeg: number;
  /**
   * Absolute hip/pelvis yaw before baseline/sign (additive). From the world
   * hip vector's depth, exactly like torsoYawDeg. See docs/scan-tracking-architecture.md §2.
   */
  hipYawDeg: number;
  /**
   * Shoulder-minus-hip separation (torsoYawDeg − hipYawDeg), the "upper body leads the
   * hips" discriminator between a trunk shoulder-check and a whole-body pivot (additive,
   * MEASURED ONLY). ⚠️ This is a difference of two noisy z-derived axial yaws
   * and hips are often low-visibility back-to-camera — it must be field-validated before
   * it can gate detection; it does not affect yawDeg or detectScans today.
   */
  shoulderHipSepDeg: number;
  /** Min hip visibility — trust signal for hipYawDeg/shoulderHipSepDeg, 0..1. */
  hipConfidence: number;
  /** Mean visibility of anterior face landmarks (back↔facing signal). */
  faceVis: number;
}

function vis(raw: RawPoseFrame, i: number): number {
  return raw.visibility?.[i] ?? raw.landmarks[i]?.visibility ?? 0;
}

/**
 * Absolute torso yaw from the world shoulder vector's depth: when the chest is
 * square to the camera the shoulder line runs across the image (`s.x` large,
 * `s.z ≈ 0` ⇒ yaw ≈ 0); as the player turns, one shoulder moves toward the
 * camera so `|s.z|` grows. Falls back to 0 (neutral) without world landmarks.
 */
export function computeTorsoYawDeg(raw: RawPoseFrame): number {
  const w = raw.world;
  const l: Landmark3D | undefined = w?.[L_SHOULDER];
  const r: Landmark3D | undefined = w?.[R_SHOULDER];
  if (l && r) {
    const sx = r.x - l.x;
    const sz = r.z - l.z;
    return (Math.atan2(sz, sx) * 180) / Math.PI;
  }
  return 0;
}

/**
 * Absolute hip/pelvis yaw from the world hip vector's depth — the exact same geometry
 * as {@link computeTorsoYawDeg} applied to landmarks 23/24. Chest-square ⇒ hips ~0°; as
 * the player pivots, one hip moves toward the camera so `|s.z|` grows. Falls back to 0
 * (neutral) without world landmarks. Additive tracking signal (see §2).
 */
export function computeHipYawDeg(raw: RawPoseFrame): number {
  const w = raw.world;
  const l: Landmark3D | undefined = w?.[L_HIP];
  const r: Landmark3D | undefined = w?.[R_HIP];
  if (l && r) {
    const sx = r.x - l.x;
    const sz = r.z - l.z;
    return (Math.atan2(sz, sx) * 180) / Math.PI;
  }
  return 0;
}

/**
 * Shoulder-minus-hip yaw separation (both absolute, pre-baseline/sign). Large positive
 * or negative magnitude ⇒ the upper body has rotated relative to the hips (a trunk
 * shoulder-check); near zero ⇒ shoulders and hips moved together (a whole-body pivot).
 * MEASURED ONLY — see the {@link FusedReading.shoulderHipSepDeg} caveat.
 */
export function shoulderHipSeparationDeg(raw: RawPoseFrame): number {
  return computeTorsoYawDeg(raw) - computeHipYawDeg(raw);
}

/** Mean visibility of the anterior face landmarks (high ⇒ facing the camera). */
export function meanFaceVis(raw: RawPoseFrame): number {
  const idx = [NOSE, L_EYE, R_EYE, MOUTH_L, MOUTH_R];
  let sum = 0;
  for (const i of idx) sum += vis(raw, i);
  return sum / idx.length;
}

/** Map one raw pose frame onto the player's yaw axis. Pure. */
export function fuse(raw: RawPoseFrame, calib: CalibrationProfile): FusedReading {
  const torsoYawDeg = computeTorsoYawDeg(raw);
  const yawDeg = (torsoYawDeg - calib.neutralYawBaselineDeg) * calib.yawSign;
  const confidence = Math.min(vis(raw, L_SHOULDER), vis(raw, R_SHOULDER));
  const hipYawDeg = computeHipYawDeg(raw);
  return {
    captureClockMs: raw.captureClockMs,
    yawDeg,
    confidence,
    torsoYawDeg,
    hipYawDeg,
    shoulderHipSepDeg: torsoYawDeg - hipYawDeg,
    hipConfidence: Math.min(vis(raw, L_HIP), vis(raw, R_HIP)),
    faceVis: meanFaceVis(raw),
  };
}

/**
 * Average torso yaw across calibration frames → the neutral baseline (the
 * back-to-camera resting orientation), captured during framing.
 */
export function computeNeutralBaselineDeg(frames: RawPoseFrame[]): number {
  if (frames.length === 0) return 0;
  const sum = frames.reduce((acc, f) => acc + computeTorsoYawDeg(f), 0);
  return sum / frames.length;
}

/**
 * Resolve the calibration `yawSign` from a neutral baseline + a known LEFT-turn
 * sample. After fuse, a player-left turn MUST read `yawDeg < 0`, where
 * `yawDeg = (torsoYawDeg − baseline) · sign`. So if the measured left turn moved
 * `(torso − baseline)` positive, the sign must flip to −1; otherwise +1. This is
 * the front-camera mirror resolution, kept pure here (the yaw-math home) so the
 * framing hook stays a thin capture state-machine. See `fuse`.
 */
export function resolveYawSign(neutralBaselineDeg: number, leftTurnDeg: number): 1 | -1 {
  return leftTurnDeg - neutralBaselineDeg > 0 ? -1 : 1;
}
