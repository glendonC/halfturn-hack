/**
 * Dev-only vision pipeline diagnostics (effective fps / mean confidence / frame
 * count) for on-field tuning. Kept OUT of the camera-native graph on purpose:
 * `CameraVerifierView` (an allow-listed native file) PUSHES per-frame stats here
 * via `recordFrameStat`, and a `__DEV__`-gated overlay POLLS `readDiagnostics`
 * on a slow interval. That indirection means the overlay re-renders at ~2fps,
 * not the ~15fps frame rate, so it never competes with the cue surface.
 *
 * `summarizeFrameStats` is pure (its own timestamps, no Date.now) → unit-tested.
 * This whole module is dependency-free and Expo-Go-safe (no native imports).
 */

/** One recorded frame's timing + tracking sample. */
export interface FrameStat {
  /** Epoch ms when the frame's result landed (used only for fps span). */
  tEpochMs: number;
  /** Reported inference time for the frame, ms. */
  inferenceMs: number;
  /** Tracking confidence (min shoulder visibility) for the frame, 0..1. */
  confidence: number;
}

/** Rolled-up pipeline health over the recent window. */
export interface VisionDiagnostics {
  /** Total frames processed since the last reset. */
  frameCount: number;
  /** Frames/sec over the retained window (0 until ≥2 frames). */
  effectiveFps: number;
  /** Mean tracking confidence over the window, 0..1 (0 when empty). */
  meanConfidence: number;
  /** Mean inference time over the window, ms (0 when empty). */
  meanInferenceMs: number;
  /** Frames retained in the window (denominator for the means). */
  windowFrames: number;
}

/** ~6s of history at the ~15fps native cap — enough for a stable fps read. */
const RING_CAPACITY = 90;

let ring: FrameStat[] = [];
let totalCount = 0;

/** Record one processed frame. Safe no-op cost; called from onResults. */
export function recordFrameStat(inferenceMs: number, confidence: number, nowMs = Date.now()): void {
  totalCount += 1;
  ring.push({ tEpochMs: nowMs, inferenceMs, confidence });
  if (ring.length > RING_CAPACITY) ring.shift();
}

/** Clear the window + counters (call at drill start / framing mount). */
export function resetDiagnostics(): void {
  ring = [];
  totalCount = 0;
}

/** Current rolled-up diagnostics (snapshot of the live ring). */
export function readDiagnostics(): VisionDiagnostics {
  return summarizeFrameStats(ring, totalCount);
}

/**
 * Pure reducer: window of frame stats + a running total → rolled-up health.
 * fps is derived from the window's own timestamp span (no wall clock needed),
 * so it's deterministic and testable with synthetic stats.
 */
export function summarizeFrameStats(stats: FrameStat[], frameCount: number): VisionDiagnostics {
  const n = stats.length;
  if (n === 0) {
    return { frameCount, effectiveFps: 0, meanConfidence: 0, meanInferenceMs: 0, windowFrames: 0 };
  }
  let confSum = 0;
  let infSum = 0;
  for (const s of stats) {
    confSum += s.confidence;
    infSum += s.inferenceMs;
  }
  const spanMs = stats[n - 1].tEpochMs - stats[0].tEpochMs;
  const effectiveFps = n >= 2 && spanMs > 0 ? ((n - 1) / spanMs) * 1000 : 0;
  return {
    frameCount,
    effectiveFps: Math.round(effectiveFps * 10) / 10,
    meanConfidence: Math.round((confSum / n) * 100) / 100,
    meanInferenceMs: Math.round(infSum / n),
    windowFrames: n,
  };
}
