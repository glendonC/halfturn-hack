import {
  computeScanVerification,
  computeTrackingQuality,
  detectScans,
} from '../scanDetect';
import { DEFAULT_SCAN_DETECT_CONFIG, type PoseSample } from '../types';
import {
  SYNTHETIC_CONFIG,
  SYNTHETIC_CUES,
  SYNTHETIC_SAMPLES,
} from '../__fixtures__/syntheticYawTrace';
import type { CueEvent } from '@/types';

/** Build a yaw trace at a fixed sample period (default 33ms ≈ 30fps). */
function trace(
  yaws: number[],
  { startMs = 0, periodMs = 33, confidence = 0.9 } = {},
): PoseSample[] {
  return yaws.map((yawDeg, i) => ({
    tMonoMs: startMs + i * periodMs,
    yawDeg,
    confidence,
  }));
}

describe('detectScans — sign convention (locks player-left == yawDeg<0)', () => {
  it('a cued-LEFT half-turn (negative yaw) is detected as direction "left"', () => {
    const samples = trace([0, 0, -30, -40, -45, -40, -30, -10, 0]);
    const scans = detectScans(samples);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.direction).toBe('left');
    expect(scans[0]!.peakYawDeg).toBeLessThan(0);
    expect(scans[0]!.startMonoMs!).toBeLessThan(scans[0]!.tMonoMs);
    expect(scans[0]!.tMonoMs).toBeLessThanOrEqual(scans[0]!.endMonoMs!);
  });

  it('a cued-RIGHT half-turn (positive yaw) is detected as direction "right"', () => {
    const samples = trace([0, 0, 30, 40, 45, 40, 30, 10, 0]);
    const scans = detectScans(samples);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.direction).toBe('right');
    expect(scans[0]!.peakYawDeg).toBeGreaterThan(0);
  });
});

describe('detectScans — debounce / hysteresis / confidence', () => {
  it('ignores a small head-bob below the enter threshold', () => {
    expect(detectScans(trace([0, 10, 18, 12, 0]))).toHaveLength(0);
  });

  it('ignores a flick that does not hold long enough', () => {
    expect(detectScans(trace([0, 40, 0]))).toHaveLength(0);
  });

  it('drops sub-confidence samples', () => {
    const samples = trace([0, -40, -45, -40, -10, 0]).map((s) => ({
      ...s,
      confidence: 0.2,
    }));
    expect(detectScans(samples)).toHaveLength(0);
  });

  it('detects two well-separated turns past the refractory period', () => {
    const first = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], {
      startMs: 0,
    });
    const second = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], {
      startMs: 600,
    });
    expect(detectScans([...first, ...second])).toHaveLength(2);
  });
});

describe('synthetic fixture', () => {
  it('detects left then right and rejects the ball-watch bob', () => {
    const scans = detectScans(SYNTHETIC_SAMPLES, SYNTHETIC_CONFIG);
    expect(scans).toHaveLength(2);
    expect(scans[0]!.direction).toBe('left');
    expect(scans[1]!.direction).toBe('right');
    expect(scans[0]!.tMonoMs).toBe(462);
    expect(scans[1]!.tMonoMs).toBe(1254);
  });

  it('computes null-honest scan verification against the cue timeline', () => {
    const scans = detectScans(SYNTHETIC_SAMPLES, SYNTHETIC_CONFIG);
    const v = computeScanVerification(
      scans,
      [...SYNTHETIC_CUES],
      60,
      'hack',
      SYNTHETIC_CONFIG,
    );
    expect(v.metricsVersion).toBe(1);
    expect(v.scannedBeforeActionRate).toBe(0.5);
    expect(v.avgReactionMs).toBe(112);
    const left = scans.filter((s) => s.direction === 'left').length;
    const right = scans.filter((s) => s.direction === 'right').length;
    expect(left).toBe(right);
    expect(v.anticipationRate).toBeUndefined();
  });

  it('reports tracking quality over the synthetic run', () => {
    const q = computeTrackingQuality(SYNTHETIC_SAMPLES, SYNTHETIC_CONFIG);
    expect(q.trackedTimeRate).toBe(1);
    expect(q.meanPoseConfidence).toBe(0.9);
    expect(q.effectiveFps).toBeGreaterThan(14);
  });
});

describe('computeScanVerification', () => {
  it('aggregates direction counts and stamps a metrics version', () => {
    const left = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], { startMs: 0 });
    const right = trace([0, 0, 30, 40, 45, 40, 30, 10, 0], { startMs: 600 });
    const scans = detectScans([...left, ...right]);
    const cues: CueEvent[] = [];
    const v = computeScanVerification(
      scans,
      cues,
      60,
      'test-engine',
      DEFAULT_SCAN_DETECT_CONFIG,
    );
    expect(v.scansDetected).toBe(2);
    expect(v.leftScans).toBe(1);
    expect(v.rightScans).toBe(1);
    expect(v.metricsVersion).toBe(1);
    expect(v.engine).toBe('test-engine');
  });
});

describe('computeScanVerification empty', () => {
  it('returns null rates when there are no cues or scans', () => {
    const cues: CueEvent[] = [];
    const v = computeScanVerification(
      [],
      cues,
      60,
      'hack',
      DEFAULT_SCAN_DETECT_CONFIG,
    );
    expect(v.scannedBeforeActionRate).toBeNull();
    expect(v.avgReactionMs).toBeNull();
    expect(v.anticipationRate).toBeUndefined();
  });
});
