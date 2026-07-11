/**
 * Pure vision detection types. Judgment lives here; native code only supplies samples.
 * PoseSample.tMonoMs shares the drill-clock axis with CueEvent.onsetDrillMs.
 */

/** One pose observation, normalized onto the drill-clock axis. */
export interface PoseSample {
  /** Drill-clock ms (same axis as CueEvent.onsetDrillMs). */
  tMonoMs: number;
  /**
   * Player-frame torso yaw, degrees.
   * yawDeg < 0 ⇒ player's LEFT; > 0 ⇒ right; 0 ⇒ neutral.
   */
  yawDeg: number;
  /** Pose/landmark confidence, 0..1. */
  confidence: number;
}

export type ScanDirection = 'left' | 'right';

/** A detected shoulder-check / scan / half-turn. */
export interface ScanEvent {
  /** Drill-clock ms at the yaw peak (recorded-reaction-time anchor). */
  tMonoMs: number;
  direction: ScanDirection;
  peakYawDeg: number;
  /** Yaw-enter crossing. */
  startMonoMs?: number;
  /** Yaw-exit crossing. */
  endMonoMs?: number;
  confidence?: number;
  /** Velocity back-extrapolated onset (measured-only; does not gate detection). */
  onsetMonoMs?: number;
  excursionDeg?: number;
  peakAngularVelDegPerSec?: number;
}

/** Tunable thresholds for turning a yaw stream into scan events. */
export interface ScanDetectConfig {
  yawEnterDeg: number;
  yawExitDeg: number;
  minHoldMs: number;
  minConfidence: number;
  refractoryMs: number;
  /** Lookback window for scanned-before-action, ms. */
  scanBeforeWindowMs: number;
}

export const DEFAULT_SCAN_DETECT_CONFIG: ScanDetectConfig = {
  yawEnterDeg: 28,
  yawExitDeg: 15,
  minHoldMs: 150,
  minConfidence: 0.5,
  refractoryMs: 400,
  scanBeforeWindowMs: 2500,
};

export interface TrackingQuality {
  trackedTimeRate: number;
  meanPoseConfidence: number;
  effectiveFps: number;
}
