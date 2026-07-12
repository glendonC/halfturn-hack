/**
 * Presentation-layer tracking thresholds for framing + camera health UI.
 * Detection thresholds live in services/vision/types.ts.
 */

export const MIN_TRACKING_CONFIDENCE = 0.5;
export const GOOD_TRACKING_CONFIDENCE = 0.7;

export type TrackingLevel = 'none' | 'poor' | 'ok' | 'good';

export function trackingLevel(confidence: number): TrackingLevel {
  if (!(confidence > 0)) return 'none';
  if (confidence >= GOOD_TRACKING_CONFIDENCE) return 'good';
  if (confidence >= MIN_TRACKING_CONFIDENCE) return 'ok';
  return 'poor';
}

export function isInFrame(confidence: number): boolean {
  return confidence >= MIN_TRACKING_CONFIDENCE;
}

/** Turn & React cue gating: hold a due cue until the player has RESET. */
export const CUE_GATE = {
  /** |yaw| at/below which the player counts as back to neutral (deg). */
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
 */
export function isReadyForCue(
  sample: { tMonoMs: number; yawDeg: number; confidence: number } | null | undefined,
  drillMs: number,
): boolean {
  if (!sample) return false;
  if (drillMs - sample.tMonoMs > CUE_GATE.staleAfterMs) return false;
  if (!isInFrame(sample.confidence)) return false;
  return Math.abs(sample.yawDeg) <= CUE_GATE.neutralMaxYawDeg;
}
