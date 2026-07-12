/**
 * Camera / pose-verification vision types (design-only — no camera code ships
 * when no camera is wired).
 *
 * The contract that matters NOW: a `PoseSample.tMonoMs` lives on the SAME
 * drill-clock axis as `CueEvent.firedAtMonoMs`, so reaction time is a pure
 * subtraction with no cross-clock skew. The audio-only build already records
 * that axis on every cue, so the camera build only has to normalize camera
 * frame timestamps onto it.
 */

import type { OneEuroConfig } from './OneEuroFilter';

/** One pose observation, normalized onto the drill-clock axis. */
export interface PoseSample {
  /** Drill-clock ms (same axis as CueEvent.firedAtMonoMs). */
  tMonoMs: number;
  /**
   * Player-frame head/shoulder yaw, degrees. **`yawDeg < 0` ⇒ player's LEFT**,
   * `> 0` ⇒ right, `0` ⇒ neutral. The phone faces the player (mirror), so the
   * sign flip + neutral-baseline subtraction happen once in YawFusion using the
   * calibrated `yawSign` — never re-derive the sign downstream.
   */
  yawDeg: number;
  /** Pose/landmark confidence, 0..1 (min shoulder *visibility*, not presence). */
  confidence: number;

  // --- Camera-build additive (optional, back-compatible) ---
  /** Absolute torso yaw before baseline/sign (0 ≈ chest plane parallel to image). */
  torsoYawDeg?: number;
  /** Mean visibility of anterior face landmarks (back↔facing signal). */
  faceVis?: number;
  /** Fused "is the player oriented toward the screen" classifier (a later enrichment). */
  facingScreen?: boolean;

  // --- Tracking additive (optional, MEASURED-ONLY; see docs/scan-tracking-architecture.md §2) ---
  /** Absolute hip/pelvis yaw before baseline/sign (from world hip vector's depth). */
  hipYawDeg?: number;
  /**
   * Shoulder-minus-hip separation — the "upper body leads the hips" discriminator
   * between a trunk shoulder-check and a whole-body pivot. ⚠️ A difference of two noisy
   * z-derived axial yaws; must be field-validated before it can gate detection.
   */
  shoulderHipSepDeg?: number;
  /** Min hip visibility — the trust signal for hipYawDeg/shoulderHipSepDeg (SNR gate). */
  hipConfidence?: number;
}

export type ScanDirection = 'left' | 'right';

/** A detected shoulder-check / scan / half-turn. */
export interface ScanEvent {
  /** Drill-clock ms at the yaw peak (the recorded-reaction-time anchor). */
  tMonoMs: number;
  direction: ScanDirection;
  peakYawDeg: number;

  // --- Camera-build additive (optional, back-compatible) ---
  /** Yaw-enter crossing — start-based reaction time + anticipation (a later enrichment). */
  startMonoMs?: number;
  /** Yaw-exit crossing (turn complete). */
  endMonoMs?: number;
  /** Confidence at the peak frame. */
  confidence?: number;
  /** Cue this scan was paired to by pairCuesToScans (a later enrichment). */
  matchedCueSeq?: number;

  // --- Body-signal enrichment (optional, MEASURED-ONLY; see docs/scan-tracking-architecture.md §4/§9) ---
  /**
   * Movement ONSET on the drill clock — velocity back-extrapolation of the rising edge
   * to the neutral crossing. The honest reaction anchor (cue→onset removes turn-execution
   * time that cue→peak conflates). Falls back toward `startMonoMs` when the rise is too
   * short to fit a slope. Always computed; does not affect detection.
   */
  onsetMonoMs?: number;
  /**
   * Total angular path swept across the scan (∫|Δyaw| over the enter→exit window incl. the
   * rising edge), degrees — a turn-size discriminator robust to a single aliased peak frame.
   * Measured-only (not yet gating).
   */
  excursionDeg?: number;
  /**
   * Peak angular velocity across the scan window, deg/s. ⚠️ Systematically UNDER-estimated
   * at the ~15fps cap (a 200–400ms turn is 3–6 frames) → confirmatory only. Measured-only.
   */
  peakAngularVelDegPerSec?: number;
}

/**
 * Per-player camera calibration captured during the framing step. Resolves the
 * two things that are otherwise ambiguous: where "neutral" (back-to-camera) is
 * on the yaw axis, and which rotation direction is the player's left.
 */
export interface CalibrationProfile {
  /** Resting torso yaw (deg), back to camera; subtracted so neutral reads ~0. */
  neutralYawBaselineDeg: number;
  /** +1 or -1 so that `yawDeg < 0` == the player's LEFT (accounts for mirroring). */
  yawSign: 1 | -1;
  /** Epoch ms when captured (0 = uncalibrated default). */
  capturedAtEpochMs: number;
  /**
   * This player's measured NEUTRAL NOISE FLOOR (deg, per-sample σ) from the framing hold — the
   * trend-blind `captureStats().sigmaDeg`. Optional: profiles captured before this measurement
   * existed read back `undefined` and keep the fixed default thresholds.
   *
   * Load-bearing, not diagnostic. Back-turned yaw noise is σ 15-25° while the shipped
   * `yawEnterDeg` is 28°, so the threshold sits INSIDE the noise and a motionless player is
   * credited with ~21 phantom scans/min. `thresholdAdapt.ts` scales the scan thresholds and the
   * cue gate off this number. See docs/scan-tracking-architecture.md §10c.
   */
  neutralNoiseSigmaDeg?: number;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  neutralYawBaselineDeg: 0,
  yawSign: 1,
  capturedAtEpochMs: 0,
};

/** Tunable thresholds for turning a yaw stream into scan events. */
export interface ScanDetectConfig {
  /** Yaw magnitude that starts a scan, degrees. */
  yawEnterDeg: number;
  /** Yaw magnitude to fall back under to end a scan (hysteresis), degrees. */
  yawExitDeg: number;
  /** Minimum time above enter threshold to count (debounce), ms. */
  minHoldMs: number;
  /** Ignore samples below this confidence. */
  minConfidence: number;
  /** Minimum gap between consecutive scans, ms. */
  refractoryMs: number;
  /** Lookback window for the "scanned before action" metric, ms. */
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

/** Reaction anchor: 'peak' (legacy, metricsVersion 1) or 'onset' (metricsVersion 2, §4). */
export type ReactionMode = 'peak' | 'onset';

/**
 * Per-run tracking-quality provenance (reliability gating, §5). Surfaced with every score so
 * History can gray out low-confidence runs; back-to-camera confidence legitimately dips.
 */
export interface TrackingQuality {
  /** Fraction [0,1] of samples above the confidence gate (`minConfidence`). */
  trackedTimeRate: number;
  /** Mean pose confidence over the run, 0..1. */
  meanPoseConfidence: number;
  /** Effective sampling rate over the run, fps. */
  effectiveFps: number;
}

/**
 * Wiring toggles for the body-signal enrichment (§9). DEFAULT is today's behavior:
 * no smoothing (detection unchanged) + peak-based reaction (metricsVersion 1). Flipping a
 * toggle is an opt-in A/B, gated in the app behind env flags and pinned in the golden fixtures.
 */
export interface EnrichmentConfig {
  /**
   * One-Euro smoothing of the DETECTION yaw stream. `null` = off (detection byte-identical).
   * ⚠️ When set it changes which scans are detected — kept off until on-device tuning (§10).
   */
  smoothing: OneEuroConfig | null;
  /** Reaction anchor for the metrics layer. `'peak'` (default) or `'onset'`. */
  reactionMode: ReactionMode;
}

export const DEFAULT_ENRICHMENT: EnrichmentConfig = { smoothing: null, reactionMode: 'peak' };
