import { computeScanVerification, detectScans } from '../scanDetect';
import { DEFAULT_SCAN_DETECT_CONFIG, type PoseSample } from '../types';
import type { CueEvent } from '@/types';

/** Build a yaw trace at a fixed sample period (default 33ms ≈ 30fps). */
function trace(yaws: number[], { startMs = 0, periodMs = 33, confidence = 0.9 } = {}): PoseSample[] {
  return yaws.map((yawDeg, i) => ({ tMonoMs: startMs + i * periodMs, yawDeg, confidence }));
}

describe('detectScans - sign convention (locks player-left == yawDeg<0)', () => {
  it('a cued-LEFT half-turn (negative yaw) is detected as direction "left"', () => {
    // 0 -> -40 (enter), hold, return to 0. ~9 samples over ~264ms.
    const samples = trace([0, 0, -30, -40, -45, -40, -30, -10, 0]);
    const scans = detectScans(samples);
    expect(scans).toHaveLength(1);
    expect(scans[0].direction).toBe('left');
    expect(scans[0].peakYawDeg).toBeLessThan(0);
    // start < peak < end on the drill-clock axis
    expect(scans[0].startMonoMs!).toBeLessThan(scans[0].tMonoMs);
    expect(scans[0].tMonoMs).toBeLessThanOrEqual(scans[0].endMonoMs!);
  });

  it('a cued-RIGHT half-turn (positive yaw) is detected as direction "right"', () => {
    const samples = trace([0, 0, 30, 40, 45, 40, 30, 10, 0]);
    const scans = detectScans(samples);
    expect(scans).toHaveLength(1);
    expect(scans[0].direction).toBe('right');
    expect(scans[0].peakYawDeg).toBeGreaterThan(0);
  });
});

describe('detectScans - debounce / hysteresis / confidence', () => {
  it('ignores a small head-bob below the enter threshold', () => {
    expect(detectScans(trace([0, 10, 18, 12, 0]))).toHaveLength(0);
  });

  it('ignores a flick that does not hold long enough', () => {
    // crosses enter for a single 33ms sample, well under minHoldMs=150
    expect(detectScans(trace([0, 40, 0]))).toHaveLength(0);
  });

  it('drops sub-confidence samples', () => {
    const samples = trace([0, -40, -45, -40, -10, 0]).map((s) => ({ ...s, confidence: 0.2 }));
    expect(detectScans(samples)).toHaveLength(0);
  });

  it('detects two well-separated turns (past the refractory period)', () => {
    // Each turn must hold past minHoldMs (150ms); 600ms apart clears refractory.
    const first = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], { startMs: 0 });
    const second = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], { startMs: 600 });
    const scans = detectScans([...first, ...second]);
    expect(scans.length).toBe(2);
  });
});

describe('computeScanVerification', () => {
  it('aggregates direction counts and stamps a metrics version', () => {
    const left = trace([0, 0, -30, -40, -45, -40, -30, -10, 0], { startMs: 0 });
    const right = trace([0, 0, 30, 40, 45, 40, 30, 10, 0], { startMs: 600 });
    const scans = detectScans([...left, ...right]);
    const cues: CueEvent[] = [];
    const v = computeScanVerification(scans, cues, 60, 'test-engine', DEFAULT_SCAN_DETECT_CONFIG);
    expect(v.scansDetected).toBe(2);
    expect(v.leftScans).toBe(1);
    expect(v.rightScans).toBe(1);
    expect(v.metricsVersion).toBe(1);
    expect(v.engine).toBe('test-engine');
  });
});
