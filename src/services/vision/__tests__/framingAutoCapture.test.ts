import {
  DEFAULT_AUTO_CAPTURE,
  appendSample,
  captureStats,
  isPresent,
  validateCapture,
  type AutoCaptureSample,
} from '../framingAutoCapture';

/** Sightings every `dtMs` from `t0` to `t1` inclusive-ish, at constant yaw. */
const steady = (t0: number, t1: number, yawDeg = 0, dtMs = 66): AutoCaptureSample[] => {
  const out: AutoCaptureSample[] = [];
  for (let t = t0; t <= t1; t += dtMs) out.push({ tMs: t, yawDeg });
  return out;
};

describe('isPresent', () => {
  const base = { nowMs: 10_000, armedAtMs: 0 };

  it('arms after the full presence window of in-frame sightings', () => {
    expect(isPresent({ ...base, samples: steady(8_000, 10_000) })).toBe(true);
  });

  it('does NOT require stillness — a rotating player still arms', () => {
    const rotating = steady(8_000, 10_000).map((s, i) => ({ ...s, yawDeg: i * 3 }));
    expect(isPresent({ ...base, samples: rotating })).toBe(true);
  });

  it('does not arm before the window is covered', () => {
    expect(isPresent({ ...base, samples: steady(9_200, 10_000) })).toBe(false);
  });

  it('tolerates brief dropouts but not real absences', () => {
    const blip = [...steady(8_000, 9_000), ...steady(9_700, 10_000)]; // 700ms gap
    expect(isPresent({ ...base, samples: blip })).toBe(true);
    const absence = [...steady(8_000, 8_800), ...steady(9_900, 10_000)]; // 1100ms gap
    expect(isPresent({ ...base, samples: absence })).toBe(false);
  });

  it('does not arm when the feed went quiet just before now', () => {
    expect(isPresent({ ...base, samples: steady(7_000, 9_000) })).toBe(false);
  });

  it('respects the refractory', () => {
    expect(isPresent({ ...base, samples: steady(8_000, 10_000), armedAtMs: 10_500 })).toBe(false);
  });

  it('needs a minimum number of sightings', () => {
    const sparse = steady(8_000, 10_000, 0, 500); // 5 < minPresenceSamples (8)
    expect(isPresent({ ...base, samples: sparse })).toBe(false);
  });
});

describe('validateCapture — center', () => {
  it('accepts a still window and returns its median', () => {
    const result = validateCapture([2, 2.5, 1.5, 2, 2, 2], 'center', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.avgYawDeg).toBe(2);
  });

  it('tolerates single-frame sensor spikes on a still player', () => {
    // A σ-based gate fails this window (std ≈ 10°); the robust gate must not.
    const spiky = [2, 2, 30, 2, 1.5, 2, 2, 2];
    const result = validateCapture(spiky, 'center', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.avgYawDeg).toBe(2);
  });

  it('rejects too few samples as lost', () => {
    const result = validateCapture([2, 2], 'center', null);
    expect(result).toMatchObject({ ok: false, reason: 'lost' });
  });

  it('rejects a turn-in-progress as moving (sustained drift)', () => {
    const turning = [0, 3, 6, 9, 12, 15, 18, 21]; // halves' medians 10.5° apart
    expect(validateCapture(turning, 'center', null)).toMatchObject({
      ok: false,
      reason: 'moving',
    });
  });

  it('rejects chaotic tracking as moving (MAD sanity bound)', () => {
    const chaos = [0, 30, -25, 28, -30, 26, -28, 25];
    expect(validateCapture(chaos, 'center', null)).toMatchObject({
      ok: false,
      reason: 'moving',
    });
  });
});

describe('validateCapture — left', () => {
  it('accepts a still window turned well away from the baseline', () => {
    expect(validateCapture([40, 41, 39, 40, 40], 'left', 0).ok).toBe(true);
  });

  it('is sign-agnostic about the turn direction', () => {
    expect(validateCapture([-40, -41, -39, -40, -40], 'left', 0).ok).toBe(true);
  });

  it('rejects a re-captured neutral stance as not_turned', () => {
    expect(validateCapture([10, 10, 10, 10, 10], 'left', 0)).toMatchObject({
      ok: false,
      reason: 'not_turned',
    });
  });

  it('rejects when no baseline exists', () => {
    expect(validateCapture([40, 40, 40, 40, 40], 'left', null)).toMatchObject({
      ok: false,
      reason: 'lost',
    });
  });
});

describe('captureStats', () => {
  it('reports robust median / MAD / drift', () => {
    const stats = captureStats([0, 1, 2, 100, 1, 1, 0, 1]);
    expect(stats.n).toBe(8);
    expect(stats.medianDeg).toBe(1);
    expect(stats.madDeg).toBeLessThanOrEqual(1);
    expect(Math.abs(stats.driftDeg)).toBeLessThanOrEqual(1.5);
  });
});

describe('appendSample', () => {
  it('appends and prunes sightings older than presence can ever need', () => {
    let w: AutoCaptureSample[] = [];
    for (let t = 0; t <= 5_000; t += 100) w = appendSample(w, { tMs: t, yawDeg: 1 });
    const horizon = 5_000 - DEFAULT_AUTO_CAPTURE.armMs - 600;
    expect(w[0].tMs).toBeGreaterThanOrEqual(horizon);
    expect(w[w.length - 1].tMs).toBe(5_000);
    // Still long enough for the coverage check to pass.
    expect(w[0].tMs).toBeLessThanOrEqual(5_000 - DEFAULT_AUTO_CAPTURE.armMs);
  });
});
