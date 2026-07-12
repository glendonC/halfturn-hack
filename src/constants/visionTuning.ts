/**
 * Field-tuning knobs for the Turn & React perception UI.
 *
 * These are the thresholds you reach for FIRST when the app misbehaves outdoors
 * — they are intentionally NOT hardcoded in components or screens. The
 * scan-DETECTION thresholds (yawEnterDeg, minHoldMs, …) live in
 * `services/vision/types.ts` as `DEFAULT_SCAN_DETECT_CONFIG`; this file owns the
 * PRESENTATION-layer tracking thresholds shared by the framing screen and the
 * in-drill camera squircle so the two never drift apart.
 *
 * Pure + dependency-free (no theme, no React) so `trackingLevel` is unit-testable
 * and safe to import anywhere, including the Expo Go graph.
 */

/** Min shoulder-visibility confidence to treat the player as "in frame". */
export const MIN_TRACKING_CONFIDENCE = 0.5;
/** Confidence at/above which tracking is considered solid (green). */
export const GOOD_TRACKING_CONFIDENCE = 0.7;

/**
 * Coarse tracking-health buckets. `none` is the pre-signal state (no frames yet,
 * e.g. Expo Go or camera warming up) — deliberately distinct from `poor` so the
 * UI doesn't flash an alarming red before the pipeline has produced anything.
 */
export type TrackingLevel = 'none' | 'poor' | 'ok' | 'good';

/**
 * Map a tracking confidence (0..1, min shoulder visibility) to a health bucket.
 * `confidence <= 0` ⇒ `none` (no signal), then poor → ok → good by threshold.
 * Pure; the caller maps the bucket to theme colors so this stays theme-free.
 */
export function trackingLevel(confidence: number): TrackingLevel {
  if (!(confidence > 0)) return 'none'; // also catches NaN
  if (confidence >= GOOD_TRACKING_CONFIDENCE) return 'good';
  if (confidence >= MIN_TRACKING_CONFIDENCE) return 'ok';
  return 'poor';
}

/** True when the player is confidently in frame (framing gate + capture guard). */
export function isInFrame(confidence: number): boolean {
  return confidence >= MIN_TRACKING_CONFIDENCE;
}

/** Turn & React cue gating: hold a due cue until the player has RESET. */
export const CUE_GATE = {
  /**
   * |yaw| at/below which the player counts as back to neutral (deg).
   *
   * This 20° is a FLOOR, not a universal truth: back-turned yaw noise was measured at σ 15-25°
   * (docs/scan-tracking-architecture.md §10b), so only ~61% of a MOTIONLESS player's samples read
   * "neutral" against it. When the player's own noise floor has been measured, the band scales off
   * it (`thresholdAdapt.deriveNeutralMaxYawDeg`) and is passed to `isReadyForCue`.
   *
   * It does NOT stall the drill, and the reason is worth keeping: `isReadyForCue` needs only ONE
   * neutral sample inside `staleAfterMs`, and 61% per sample means essentially every window has
   * one — measured, a due cue is held 0% of the time under both bands. The scaling is for
   * CONSISTENCY with the noise-scaled scan thresholds, not a fix for an observed stall.
   */
  neutralMaxYawDeg: 20,
  /** A pose sample older than this no longer proves readiness (ms). */
  staleAfterMs: 800,
  /** Never hold a due cue longer than this — the drill must not stall. */
  maxHoldMs: 5000,
} as const;

/**
 * True when the latest live sample proves the player is ready for the next
 * cue: fresh, confidently in frame, and back near neutral yaw. Structural
 * sample type so this file stays import-free of the vision service.
 *
 * `neutralMaxYawDeg` defaults to the fixed `CUE_GATE` band; the drill passes this player's
 * noise-scaled band when their calibration carries a measured noise floor.
 */
export function isReadyForCue(
  sample: { tMonoMs: number; yawDeg: number; confidence: number } | null | undefined,
  drillMs: number,
  neutralMaxYawDeg: number = CUE_GATE.neutralMaxYawDeg,
): boolean {
  if (!sample) return false;
  if (drillMs - sample.tMonoMs > CUE_GATE.staleAfterMs) return false;
  if (!isInFrame(sample.confidence)) return false;
  return Math.abs(sample.yawDeg) <= neutralMaxYawDeg;
}
