import {
  BACK_TURNED_ACCEPTED,
  BACK_TURNED_NOISY,
  TURNED_LEFT,
} from '../__fixtures__/realFramingCaptures';
import {
  DEFAULT_AUTO_CAPTURE,
  appendSample,
  captureStats,
  isPresent,
  validateCapture,
  type AutoCaptureSample,
  type CaptureSample,
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

/** Capture samples from raw yaws; back-turned face visibility by default. */
const win = (yaws: readonly number[], faceVis = 0.1) =>
  yaws.map((yawDeg) => ({ yawDeg, faceVis }));

describe('validateCapture — center', () => {
  it('accepts a still, back-turned window and returns its median', () => {
    const result = validateCapture(win([2, 2.5, 1.5, 2, 2, 2]), 'center', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.avgYawDeg).toBe(2);
  });

  it('tolerates single-frame sensor spikes on a still player', () => {
    // A σ-based gate fails this window (std ≈ 10°); the robust gate must not.
    const result = validateCapture(win([2, 2, 30, 2, 1.5, 2, 2, 2]), 'center', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.avgYawDeg).toBe(2);
  });

  it('does NOT face-check (MediaPipe hallucinates ~0.95 faceVis on a turned back)', () => {
    expect(validateCapture(win([2, 2, 2, 2, 2, 2], 0.95), 'center', null).ok).toBe(true);
  });

  it('rejects too few samples as lost', () => {
    expect(validateCapture(win([2, 2]), 'center', null)).toMatchObject({
      ok: false,
      reason: 'lost',
    });
  });

  it('rejects a turn-in-progress as moving (sustained drift)', () => {
    const turning = win([0, 3, 6, 9, 12, 15, 18, 21]); // halves' medians 10.5° apart
    expect(validateCapture(turning, 'center', null)).toMatchObject({
      ok: false,
      reason: 'moving',
    });
  });

  it('rejects chaotic tracking as UNSTABLE, not as moving', () => {
    // A chaotic read is a setup problem (distance/light/background/tracker), not a player
    // problem. Blaming it on the player — the old behavior — sends them into a loop: they hold
    // stiller, it fails again, and the spoken line never names anything they can actually fix.
    const chaos = win([0, 30, -25, 28, -30, 26, -28, 25]);
    expect(validateCapture(chaos, 'center', null)).toMatchObject({
      ok: false,
      reason: 'unstable',
    });
  });

  it('still blames a genuine drift on the player, not on the tracker', () => {
    const turning = win([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(validateCapture(turning, 'center', null).ok).toBe(false);
    expect(validateCapture(turning, 'center', null)).toMatchObject({ reason: 'moving' });
  });
});

describe('REAL field captures (iPhone, pose lite, ~3m, back to camera)', () => {
  /** The dev log emits bare yaw degrees; faceVis is irrelevant to these gates. */
  const real = (yaws: readonly number[]): CaptureSample[] =>
    yaws.map((yawDeg) => ({ yawDeg, faceVis: 0.98 }));

  it('measures a back-turned noise floor an order of magnitude worse than turned', () => {
    // The whole reason calibration was failing. MediaPipe cannot see the chest of a back-on
    // torso, so the world-z the yaw derivation depends on is barely constrained — in exactly the
    // stance this drill calls "neutral".
    const backA = captureStats(real(BACK_TURNED_NOISY));
    const backB = captureStats(real(BACK_TURNED_ACCEPTED));
    const turned = captureStats(real(TURNED_LEFT));

    expect(backA.madDeg).toBeGreaterThan(10);
    expect(backB.madDeg).toBeGreaterThan(5);
    expect(turned.madDeg).toBeLessThan(2);
    expect(backA.sigmaDeg).toBeGreaterThan(10 * turned.sigmaDeg);
  });

  it('finds NO front/back flipping — the hypothesis this data refuted', () => {
    // A tracker flipping its front/back read would also explode MAD. It is not what happens.
    for (const w of [BACK_TURNED_NOISY, BACK_TURNED_ACCEPTED, TURNED_LEFT]) {
      expect(captureStats(real(w)).flipRate).toBe(0);
    }
  });

  it('does NOT blame the still player for moving (the shipped bug)', () => {
    // BACK_TURNED_NOISY was rejected in the field and the app said "too much movement". Its
    // 32.5° drift is well inside the ~13.6° standard error that this read's own noise produces,
    // so it is not evidence of movement at all. It may still be rejected — but never as 'moving'.
    const s = captureStats(real(BACK_TURNED_NOISY));
    expect(Math.abs(s.driftDeg)).toBeLessThan(DEFAULT_AUTO_CAPTURE.driftSigmas * s.driftSeDeg);

    const v = validateCapture(real(BACK_TURNED_NOISY), 'center', null);
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ reason: 'unstable' }); // honest: the READ is bad, not the player
  });

  it('accepts the capture the field accepted', () => {
    expect(validateCapture(real(BACK_TURNED_ACCEPTED), 'center', null).ok).toBe(true);
    expect(validateCapture(real(TURNED_LEFT), 'left', -127).ok).toBe(true);
  });

  it('accepts the noisy window once enough frames are averaged (why the window doubled)', () => {
    // Identical signal, twice the samples — which is exactly what FRAMING_CAPTURE_MS 1500→3000
    // buys. The baseline SE falls as 1/√n, so the read becomes usable without the signal
    // improving at all. This is the fix for the player who kept being told to hold stiller.
    const short = captureStats(real(BACK_TURNED_NOISY));
    const long = captureStats(real([...BACK_TURNED_NOISY, ...BACK_TURNED_NOISY]));

    expect(short.baselineSeDeg).toBeGreaterThan(DEFAULT_AUTO_CAPTURE.maxBaselineSeDeg);
    expect(long.baselineSeDeg).toBeLessThan(DEFAULT_AUTO_CAPTURE.maxBaselineSeDeg);
    expect(validateCapture(real([...BACK_TURNED_NOISY, ...BACK_TURNED_NOISY]), 'center', null).ok).toBe(
      true,
    );
  });
});

describe('captureStats — noise is estimated trend-blind', () => {
  const w = (yaws: number[]): CaptureSample[] => yaws.map((yawDeg) => ({ yawDeg, faceVis: 0.9 }));

  it('a steady turn does not inflate its own noise estimate into an alibi', () => {
    // MAD measures TOTAL spread, so a ramp inflates it — and a drift test scaled by that
    // inflated noise would excuse the very turn it exists to catch. Successive differences are
    // blind to a smooth trend, so the turn stays detectable.
    const ramp = w([0, 3, 6, 9, 12, 15, 18, 21]);
    const s = captureStats(ramp);
    expect(s.madDeg).toBeGreaterThan(4); // the trend inflates MAD…
    expect(s.sigmaDeg).toBeLessThan(4); // …but not the successive-difference noise
    expect(validateCapture(ramp, 'center', null)).toMatchObject({ reason: 'moving' });
  });
});

describe('captureStats — axial diagnostics (flip vs jitter)', () => {
  it('reports flip≈0 on a still player', () => {
    const s = captureStats(win([180, 179, -179, 180, 178, -180]));
    expect(s.flipRate).toBe(0);
    expect(s.axialMadDeg).toBeLessThan(2);
  });

  it('separates a TRACKER FLIP from a moving player', () => {
    // The player is rock still, back to the camera (~180°), but MediaPipe keeps flipping its
    // front/back read of the body, so yaw jumps ~180° between frames. This is the signature we
    // suspect in the field: the ordinary circular mean degenerates (the two modes cancel), MAD
    // explodes, and the capture gets blamed on the player.
    const flipping = win([180, 0, 179, 1, -179, 0, 180, -1]);
    const s = captureStats(flipping);

    expect(s.flipRate).toBeGreaterThan(0.4); // the tracker changed its mind about half the time
    expect(s.axialMadDeg).toBeLessThan(2); // …about a body that never actually moved
    expect(s.madDeg).toBeGreaterThan(30); // …yet the ordinary spread looks like wild motion

    // So today it is rejected — but now with the honest reason, and the stats say why.
    expect(validateCapture(flipping, 'center', null)).toMatchObject({ reason: 'unstable' });
  });

  it('a genuinely jittery read has a HIGH axial spread and no flips', () => {
    // The other cause of a high MAD: real angular noise, no front/back ambiguity. Distinguishing
    // these two decides whether the fix is a threshold or the signal itself.
    const s = captureStats(win([0, 30, -25, 28, -30, 26, -28, 25]));
    expect(s.flipRate).toBe(0);
    // ~16.5° here vs <2° for the flip case above — the two causes separate cleanly, which is
    // the whole point: one is fixed by a threshold, the other by fixing the signal.
    expect(s.axialMadDeg).toBeGreaterThan(10);
  });
});

describe('validateCapture — left', () => {
  it('accepts a still window turned well away from the baseline', () => {
    expect(validateCapture(win([40, 41, 39, 40, 40]), 'left', 0).ok).toBe(true);
  });

  it('does NOT face-check the left capture (a profile face is expected)', () => {
    expect(validateCapture(win([40, 41, 39, 40, 40], 0.8), 'left', 0).ok).toBe(true);
  });

  it('is sign-agnostic about the turn direction', () => {
    expect(validateCapture(win([-40, -41, -39, -40, -40]), 'left', 0).ok).toBe(true);
  });

  it('rejects a re-captured neutral stance as not_turned', () => {
    expect(validateCapture(win([10, 10, 10, 10, 10]), 'left', 0)).toMatchObject({
      ok: false,
      reason: 'not_turned',
    });
  });

  it('rejects when no baseline exists', () => {
    expect(validateCapture(win([40, 40, 40, 40, 40]), 'left', null)).toMatchObject({
      ok: false,
      reason: 'lost',
    });
  });
});

describe('validateCapture — the ±180° seam (back-turned stance)', () => {
  it('accepts a still player whose yaw straddles the wrap seam', () => {
    // Physically still at the back-to-camera stance: readings flicker between
    // +178 and −178. Linear stats read this as MAD ≈ 178 / drift ≈ −356.
    const seam = win([178, -179, 179, -178, 178, -179, 179, -178]);
    const result = validateCapture(seam, 'center', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Math.abs(result.avgYawDeg)).toBeGreaterThan(170);
  });

  it('judges the left-turn delta circularly across the seam', () => {
    // Baseline −156 (back turned); left capture reads +150: linear delta 306,
    // true circular delta −54 — clearly turned, must pass.
    expect(validateCapture(win([150, 151, 149, 150, 150]), 'left', -156).ok).toBe(true);
    // And a re-captured neutral on the other side of the seam is still caught:
    // baseline −170 vs +180 is only 10° apart circularly.
    expect(validateCapture(win([180, 179, -180, 180, 179]), 'left', -170)).toMatchObject({
      ok: false,
      reason: 'not_turned',
    });
  });
});

describe('captureStats', () => {
  it('reports robust median / MAD / drift / face visibility', () => {
    const stats = captureStats(win([0, 1, 2, 100, 1, 1, 0, 1], 0.2));
    expect(stats.n).toBe(8);
    expect(stats.medianDeg).toBe(1);
    expect(stats.madDeg).toBeLessThanOrEqual(1);
    expect(Math.abs(stats.driftDeg)).toBeLessThanOrEqual(1.5);
    expect(stats.faceVisMedian).toBe(0.2);
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
