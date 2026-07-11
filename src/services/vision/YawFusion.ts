/**
 * YawFusion — pure layer between a frame PerceptionBackend and detectScans.
 * Collapses landmarks to yawDeg + confidence. No camera / native imports.
 */

import type { Landmark3D, RawPoseFrame } from './PerceptionBackend';
import type { CalibrationProfile } from './types';

const NOSE = 0;
const L_EYE = 2;
const R_EYE = 5;
const MOUTH_L = 9;
const MOUTH_R = 10;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;

export interface FusedReading {
  captureClockMs: number;
  /** Player-frame yaw (baseline-subtracted, sign-flipped): < 0 ⇒ player left. */
  yawDeg: number;
  confidence: number;
  torsoYawDeg: number;
  hipYawDeg: number;
  shoulderHipSepDeg: number;
  hipConfidence: number;
  faceVis: number;
}

function vis(raw: RawPoseFrame, i: number): number {
  return raw.visibility?.[i] ?? raw.landmarks[i]?.visibility ?? 0;
}

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

export function shoulderHipSeparationDeg(raw: RawPoseFrame): number {
  return computeTorsoYawDeg(raw) - computeHipYawDeg(raw);
}

export function meanFaceVis(raw: RawPoseFrame): number {
  const idx = [NOSE, L_EYE, R_EYE, MOUTH_L, MOUTH_R];
  let sum = 0;
  for (const i of idx) sum += vis(raw, i);
  return sum / idx.length;
}

export function fuse(
  raw: RawPoseFrame,
  calib: CalibrationProfile,
): FusedReading {
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

export function computeNeutralBaselineDeg(frames: RawPoseFrame[]): number {
  if (frames.length === 0) return 0;
  const sum = frames.reduce((acc, f) => acc + computeTorsoYawDeg(f), 0);
  return sum / frames.length;
}

/** Resolve yawSign so a known left turn reads yawDeg < 0 after fuse. */
export function resolveYawSign(
  neutralBaselineDeg: number,
  leftTurnDeg: number,
): 1 | -1 {
  return leftTurnDeg - neutralBaselineDeg > 0 ? -1 : 1;
}
