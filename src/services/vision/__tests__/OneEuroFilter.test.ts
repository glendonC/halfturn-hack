import { DEFAULT_ONE_EURO_CONFIG, OneEuroFilter } from '../OneEuroFilter';

const FRAME_MS = 1000 / 15;
const t = (i: number) => i * FRAME_MS;

function std(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

describe('OneEuroFilter — basics', () => {
  it('passes the first sample through unchanged', () => {
    const f = new OneEuroFilter();
    expect(f.filter(42, t(0))).toBe(42);
  });

  it('holds a constant signal at steady state', () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i < 20; i += 1) out = f.filter(20, t(i));
    expect(out).toBeCloseTo(20, 9);
  });

  it('holds the smoothed estimate when the clock does not advance', () => {
    const f = new OneEuroFilter();
    f.filter(10, t(5));
    expect(f.filter(13, t(5))).toBe(10);
    expect(f.filter(13, t(4))).toBe(10);
  });

  it('does not let a duplicate-timestamp outlier spike the next sample', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 20; i += 1) f.filter(20, t(i));
    f.filter(40, t(19));
    expect(f.filter(20, t(20))).toBeCloseTo(20, 6);
  });

  it('produces finite outputs on a noisy run', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 50; i += 1) {
      const out = f.filter(15 + (i % 2 === 0 ? 1 : -1), t(i));
      expect(Number.isFinite(out)).toBe(true);
    }
  });
});

describe('OneEuroFilter — jitter and adaptivity', () => {
  it('attenuates Nyquist jitter around a constant', () => {
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const filtered: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const x = 20 + (i % 2 === 0 ? 1 : -1);
      raw.push(x);
      filtered.push(f.filter(x, t(i)));
    }
    expect(std(filtered.slice(10))).toBeLessThan(std(raw.slice(10)) * 0.6);
  });

  it('lags a fast ramp less with beta>0 than beta=0', () => {
    const slopePerFrame = 100 * (FRAME_MS / 1000);
    const fixed = new OneEuroFilter({ ...DEFAULT_ONE_EURO_CONFIG, beta: 0 });
    const adaptive = new OneEuroFilter({
      ...DEFAULT_ONE_EURO_CONFIG,
      beta: 0.05,
    });
    let lastX = 0;
    let fixedOut = 0;
    let adaptiveOut = 0;
    for (let i = 0; i < 30; i += 1) {
      lastX = i * slopePerFrame;
      fixedOut = fixed.filter(lastX, t(i));
      adaptiveOut = adaptive.filter(lastX, t(i));
    }
    expect(Math.abs(lastX - adaptiveOut)).toBeLessThan(
      Math.abs(lastX - fixedOut),
    );
  });
});

describe('OneEuroFilter — reset', () => {
  it('clears history so the next sample passes through', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 10; i += 1) f.filter(30, t(i));
    f.reset();
    expect(f.filter(5, t(0))).toBe(5);
  });
});
