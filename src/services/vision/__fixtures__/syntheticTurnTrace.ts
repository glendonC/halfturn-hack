/**
 * Synthetic golden fixture — a scripted, deterministic RawPoseFrame trace for the
 * regression tripwire (docs/scan-tracking-architecture.md §7, layer 1). It is
 * SYNTHETIC (authored world-shoulder/hip vectors), so committing it carries no
 * athlete data — the fixture-privacy test allows raw landmark math only when marked
 * `synthetic: true`. Real device captures are DERIVED-only (see frameCapture.ts) and
 * never land here as raw frames.
 *
 * The trace scripts a neutral hold → a LEFT half-turn (peaks past the 28° enter,
 * holds, returns) → a sub-threshold ball-watch BOB (must NOT count) → a RIGHT
 * half-turn, at the ~15fps (66ms) cadence, with integer capture clocks so every
 * derived tMonoMs is an exact integer. Calibration is identity (neutral 0, sign +1)
 * so the authored yaw IS the player-frame yaw. The cue timeline, duration, engine
 * label, and detector config are all frozen here so computeScanVerification is fully
 * reproducible and a future threshold retune shows up as a visible fixture diff.
 */

import type { CueEvent } from '@/types';
import type { Landmark, Landmark3D, RawPoseFrame } from '../PerceptionBackend';
import type { CalibrationProfile, ScanDetectConfig } from '../types';

// MediaPipe BlazePose indices (mirror YawFusion).
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const LANDMARK_COUNT = 25; // 0..24 covers shoulders + hips + face indices YawFusion reads

const FRAME_SPACING_MS = 66; // ~15fps native cap
const BASE_CLOCK_MS = 100_000; // arbitrary integer capture-clock origin
const VIS = 0.9; // well above the 0.5 confidence gate

/**
 * Player-frame torso yaw per frame (deg; <0 = left). Segments, by index:
 *  0–4  neutral   5–10 LEFT turn (enter@6 t=396, peak@7 t=462, exit@10 t=660)
 *  11–16 neutral + ball-watch bob (|yaw|<28 → rejected)
 *  17–22 RIGHT turn (enter@18 t=1188, peak@19 t=1254, exit@22 t=1452)  23–25 neutral tail
 */
const YAW_SCRIPT: number[] = [
  0, 0, 0, 0, 0, -15, -30, -45, -45, -25, -10, 0, -10, 8, -6, 0, 0, 18, 33, 45, 40, 20, 12, 0, 0, 0,
];

function makeFrame(idx: number, yawDeg: number): RawPoseFrame {
  const rad = (yawDeg * Math.PI) / 180;
  // Shoulder/hip vectors whose depth (z) encodes yaw: atan2(sz, sx) recovers `rad`.
  const world: Landmark3D[] = Array.from({ length: LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: VIS,
  }));
  world[R_SHOULDER] = { x: 0.2 * Math.cos(rad), y: 0, z: 0.2 * Math.sin(rad), visibility: VIS };
  world[L_SHOULDER] = { x: -0.2 * Math.cos(rad), y: 0, z: -0.2 * Math.sin(rad), visibility: VIS };
  world[R_HIP] = { x: 0.15 * Math.cos(rad), y: 0, z: 0.15 * Math.sin(rad), visibility: VIS };
  world[L_HIP] = { x: -0.15 * Math.cos(rad), y: 0, z: -0.15 * Math.sin(rad), visibility: VIS };
  const visibility = Array.from({ length: LANDMARK_COUNT }, () => VIS);
  const landmarks: Landmark[] = world.map((w) => ({ x: w.x, y: w.y, z: w.z, visibility: VIS }));
  return {
    captureClockMs: BASE_CLOCK_MS + idx * FRAME_SPACING_MS,
    landmarks,
    world,
    visibility,
    modelId: 'synthetic',
  };
}

export const SYNTHETIC_FRAMES: RawPoseFrame[] = YAW_SCRIPT.map((yawDeg, idx) =>
  makeFrame(idx, yawDeg),
);

/** Identity calibration: authored yaw is already player-frame. */
export const SYNTHETIC_CALIBRATION: CalibrationProfile = {
  neutralYawBaselineDeg: 0,
  yawSign: 1,
  capturedAtEpochMs: 0,
};

/** Detector config pinned in-fixture (not imported) so a retune is a visible diff. */
export const SYNTHETIC_CONFIG: ScanDetectConfig = {
  yawEnterDeg: 28,
  yawExitDeg: 15,
  minHoldMs: 150,
  minConfidence: 0.5,
  refractoryMs: 400,
  scanBeforeWindowMs: 2500,
};

/**
 * Two action cues on the 0-based drill axis (tMonoMs = idx*66):
 *  - seq 0 @350ms — just before the left peak (462) → reaction 112ms; no prior scan.
 *  - seq 1 @1400ms — after the right peak (1254) → scanned-before, no later scan.
 * ⇒ avgReactionMs 112, scannedBeforeActionRate 0.5.
 */
export const SYNTHETIC_CUES: CueEvent[] = [
  { seq: 0, cueId: 'turn', category: 'action', phrase: 'Turn', side: 'none', firedAtMonoMs: 350, firedAtEpochMs: 0, plannedOffsetMs: 350 },
  { seq: 1, cueId: 'turn', category: 'action', phrase: 'Turn', side: 'none', firedAtMonoMs: 1400, firedAtEpochMs: 0, plannedOffsetMs: 1400 },
];

export const SYNTHETIC_ENGINE_LABEL = 'synthetic-golden';
export const SYNTHETIC_ACTUAL_DURATION_SEC = 2;
