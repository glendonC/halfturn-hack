import { DEFAULT_ONE_EURO_CONFIG, OneEuroFilter } from '../OneEuroFilter';

const FRAME_MS = 1000 / 15; // the ~15fps grid the yaw signal lives on

/** Timestamp for sample index i on the 15fps grid. */
const t = (i: number) => i * FRAME_MS;

/** Population standard deviation of a numeric series. */
function std(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

describe('OneEuroFilter — basics', () => {
  it('passes the first sample through unchanged (no history to smooth against)', () => {
    const f = new OneEuroFilter();
    expect(f.filter(42, t(0))).toBe(42);
  });

  it('holds a constant signal exactly at the constant (steady state has zero error)', () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i < 20; i += 1) out = f.filter(20, t(i));
    expect(out).toBeCloseTo(20, 9);
  });

  it('HOLDS the smoothed estimate (no NaN, no spike) when the clock does not advance', () => {
    const f = new OneEuroFilter();
    f.filter(10, t(5)); // seed → estimate 10
    expect(f.filter(13, t(5))).toBe(10); // duplicate timestamp → hold, not the raw 13
    expect(f.filter(13, t(4))).toBe(10); // backward timestamp → hold, clock not regressed
  });

  it('does not let a duplicate-timestamp outlier spike the NEXT real sample', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 20; i += 1) f.filter(20, t(i)); // converge to 20
    f.filter(40, t(19)); // duplicate-timestamp outlier — must not poison state
    const next = f.filter(20, t(20)); // the next genuine sample
    // Without the hold-fix this returned ~30 (α·20 + (1−α)·40); with it, ~20.
    expect(next).toBeCloseTo(20, 6);
  });

  it('produces no NaN/Infinity across a normal noisy run', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 50; i += 1) {
      const out = f.filter(15 + (i % 2 === 0 ? 1 : -1), t(i));
      expect(Number.isFinite(out)).toBe(true);
    }
  });
});

describe('OneEuroFilter — jitter suppression', () => {
  it('attenuates fast alternating (Nyquist) jitter around a constant', () => {
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const filtered: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const x = 20 + (i % 2 === 0 ? 1 : -1); // ±1 deg alternating every frame
      raw.push(x);
      filtered.push(f.filter(x, t(i)));
    }
    // Drop the warmup; the low-pass should shrink the deviation from 20.
    expect(std(filtered.slice(10))).toBeLessThan(std(raw.slice(10)) * 0.6);
  });
});

describe('OneEuroFilter — speed adaptivity (the reason to use it over a fixed EMA)', () => {
  it('lags a fast ramp LESS with beta>0 than a fixed low-pass (beta=0)', () => {
    const slopePerFrame = 100 * (FRAME_MS / 1000); // ~100 deg/s ramp
    const fixed = new OneEuroFilter({ ...DEFAULT_ONE_EURO_CONFIG, beta: 0 });
    const adaptive = new OneEuroFilter({ ...DEFAULT_ONE_EURO_CONFIG, beta: 0.05 });

    let lastX = 0;
    let fixedOut = 0;
    let adaptiveOut = 0;
    for (let i = 0; i < 30; i += 1) {
      lastX = i * slopePerFrame;
      fixedOut = fixed.filter(lastX, t(i));
      adaptiveOut = adaptive.filter(lastX, t(i));
    }
    const fixedLag = Math.abs(lastX - fixedOut);
    const adaptiveLag = Math.abs(lastX - adaptiveOut);
    // The whole point of One-Euro: the adaptive cutoff tracks the fast phase tighter.
    expect(adaptiveLag).toBeLessThan(fixedLag);
  });
});

describe('OneEuroFilter — reset', () => {
  it('clears history so the next sample passes through again', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 10; i += 1) f.filter(30, t(i));
    f.reset();
    expect(f.filter(5, t(0))).toBe(5); // fresh: first post-reset sample passes through
  });
});
