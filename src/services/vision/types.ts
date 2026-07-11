/**
 * Pure vision detection types. Judgment lives here; native code only supplies samples.
 * PoseSample.tMonoMs shares the drill-clock axis with CueEvent.firedAtMonoMs.
 */

import type { OneEuroConfig } from './OneEuroFilter';

/** One pose observation, normalized onto the drill-clock axis. */
export interface PoseSample {
  /** Drill-clock ms (same axis as CueEvent.firedAtMonoMs). */
  tMonoMs: number;
  /**
   * Player-frame torso yaw, degrees.
   * yawDeg < 0 ⇒ player's LEFT; > 0 ⇒ right; 0 ⇒ neutral.
   */
  yawDeg: number;
  /** Pose/landmark confidence, 0..1. */
  confidence: number;
  /** Absolute torso yaw before baseline/sign. */
  torsoYawDeg?: number;
  /** Mean visibility of anterior face landmarks. */
  faceVis?: number;
  facingScreen?: boolean;
  hipYawDeg?: number;
  shoulderHipSepDeg?: number;
  hipConfidence?: number;
}

/** Reaction anchor: 'peak' (legacy, metricsVersion 1) or 'onset' (metricsVersion 2). */
export type ReactionMode = 'peak' | 'onset';

/** Wiring toggles for body-signal enrichment. Default = today's detection. */
export interface EnrichmentConfig {
  smoothing: OneEuroConfig | null;
  reactionMode: ReactionMode;
}

export const DEFAULT_ENRICHMENT: EnrichmentConfig = {
  smoothing: null,
  reactionMode: 'peak',
};

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

/**
 * Per-player camera calibration from the framing step.
 * Resolves neutral (back-to-camera) and which rotation is the player's left.
 */
export interface CalibrationProfile {
  neutralYawBaselineDeg: number;
  /** +1 or -1 so yawDeg < 0 == player's LEFT. */
  yawSign: 1 | -1;
  capturedAtEpochMs: number;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  neutralYawBaselineDeg: 0,
  yawSign: 1,
  capturedAtEpochMs: 0,
};
