import { summarizeFrameStats, type FrameStat } from '../diagnostics';

/** Frames at a fixed period so fps is exact: 40ms period ⇒ 25fps. */
function stats(n: number, { periodMs = 40, confidence = 0.8, inferenceMs = 10, startMs = 0 } = {}): FrameStat[] {
  return Array.from({ length: n }, (_, i) => ({
    tEpochMs: startMs + i * periodMs,
    inferenceMs,
    confidence,
  }));
}

describe('summarizeFrameStats', () => {
  it('returns zeros for an empty window but preserves the running frame count', () => {
    const d = summarizeFrameStats([], 42);
    expect(d).toEqual({
      frameCount: 42,
      effectiveFps: 0,
      meanConfidence: 0,
      meanInferenceMs: 0,
      windowFrames: 0,
    });
  });

  it('derives fps from the window timestamp span (25fps at 40ms period)', () => {
    // 26 frames over 25 periods = 1000ms span ⇒ 25 intervals / 1s = 25fps.
    const d = summarizeFrameStats(stats(26), 100);
    expect(d.effectiveFps).toBe(25);
    expect(d.windowFrames).toBe(26);
    expect(d.frameCount).toBe(100);
  });

  it('averages confidence and inference over the window', () => {
    const mixed: FrameStat[] = [
      { tEpochMs: 0, inferenceMs: 8, confidence: 0.6 },
      { tEpochMs: 40, inferenceMs: 12, confidence: 0.8 },
    ];
    const d = summarizeFrameStats(mixed, 2);
    expect(d.meanConfidence).toBe(0.7);
    expect(d.meanInferenceMs).toBe(10);
  });

  it('reports 0 fps for a single frame (no span)', () => {
    expect(summarizeFrameStats(stats(1), 1).effectiveFps).toBe(0);
  });
});
