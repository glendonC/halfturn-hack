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
