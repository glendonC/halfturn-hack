import { DEFAULT_ONE_EURO_CONFIG } from '../OneEuroFilter';
import { smoothPoseSamples } from '../sampleSmoothing';
import type { PoseSample } from '../types';

describe('smoothPoseSamples', () => {
  it('returns a new stream with smoothed yawDeg and echoed clocks', () => {
    const samples: PoseSample[] = [
      { tMonoMs: 0, yawDeg: 0, confidence: 0.9 },
      { tMonoMs: 66, yawDeg: 10, confidence: 0.9 },
      { tMonoMs: 132, yawDeg: 20, confidence: 0.8 },
    ];
    const out = smoothPoseSamples(samples, DEFAULT_ONE_EURO_CONFIG);
    expect(out).toHaveLength(3);
    expect(out[0]!.yawDeg).toBe(0);
    expect(out[0]!.tMonoMs).toBe(0);
    expect(out[2]!.confidence).toBe(0.8);
    expect(out[1]!.yawDeg).not.toBe(10); // smoothed away from raw step
  });
});
