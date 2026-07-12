import { mulberry32 } from '@/utils/random';

import {
  BACK_TURNED_ACCEPTED,
  BACK_TURNED_NOISY,
  TURNED_LEFT,
} from '../../__fixtures__/realFramingCaptures';
import { DEFAULT_ONE_EURO_CONFIG, type OneEuroConfig } from '../../OneEuroFilter';
import { DEFAULT_SCAN_DETECT_CONFIG, type ScanDetectConfig } from '../../types';
import {
  countPhantomScans,
  measureOnsetPrecision,
  residualsFrom,
  stationaryStream,
  turnTrace,
} from '../phantomScans';

/**
 * Is the scan detector trustworthy at all?
 *
 * The noise is REAL (block-bootstrapped from the captured back-turned windows), the detector is the
 * FROZEN one the app runs, and the simulated player is either standing perfectly still or making one
 * unambiguous 133° half-turn. So every number here is a fact about the shipped detector, not a
 * model of one. See docs/scan-tracking-architecture.md §10c.
 *
 * Two independent failures fall out, and they have the SAME cause — `yawEnterDeg` (28°) sits inside
 * the back-turned noise, whose σ is 15-25° and whose peaks reach 45°:
 *   1. a motionless player is credited with ~21 scans/min that never happened;
 *   2. a real turn is shredded into several scans, so its onset — and therefore `reactionMs` — is
 *      timed with an SD of ~390ms, which is as large as the human reaction it is trying to measure.
 */

const DRILL_SEC = 300; // a 5-minute drill
const REAL_WINDOWS = [BACK_TURNED_NOISY, BACK_TURNED_ACCEPTED];

const stillFor = (windows: readonly (readonly number[])[], seed: number) =>
  stationaryStream({ realYawWindows: windows, durationSec: DRILL_SEC, rng: mulberry32(seed) });

const realTurn = (seed: number) =>
  turnTrace({ realYawWindows: REAL_WINDOWS, rng: mulberry32(100 + seed) });

/** The candidate fix: lift the threshold clear of the noise. See §10c and W3. */
const RAISED: ScanDetectConfig = { ...DEFAULT_SCAN_DETECT_CONFIG, yawEnterDeg: 55, yawExitDeg: 29 };

describe('phantom scans from real back-turned noise', () => {
  it('residuals recover the motionless player’s jitter around a zero baseline', () => {
    const r = residualsFrom(BACK_TURNED_NOISY);
    expect(r).toHaveLength(BACK_TURNED_NOISY.length);
    // Baseline-subtracted, so it is centered on 0 — exactly what PoseSample.yawDeg carries.
    expect(Math.abs(r.reduce((a, b) => a + b, 0) / r.length)).toBeLessThan(15);
    // And it must not be inflated by the ±180° seam.
    expect(Math.max(...r.map(Math.abs))).toBeLessThan(90);
  });

  it('MEASURES the phantom rate a still player produces at the shipped threshold', () => {
    const noisy = countPhantomScans(stillFor([BACK_TURNED_NOISY], 1));
    const typical = countPhantomScans(stillFor(REAL_WINDOWS, 2));
    const calm = countPhantomScans(stillFor([BACK_TURNED_ACCEPTED], 3));

    // eslint-disable-next-line no-console
    console.log(
      `\n[phantom scans] a MOTIONLESS player, ${DRILL_SEC}s, real noise, frozen detector ` +
        `(yawEnterDeg=${DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg}°)\n` +
        `  worst-case window   : ${noisy.phantomScans} scans (${noisy.phantomsPerMin.toFixed(1)}/min, peak |yaw| ${noisy.peakAbsYawDeg.toFixed(0)}°)\n` +
        `  mixed real windows  : ${typical.phantomScans} scans (${typical.phantomsPerMin.toFixed(1)}/min, peak |yaw| ${typical.peakAbsYawDeg.toFixed(0)}°)\n` +
        `  calmest window      : ${calm.phantomScans} scans (${calm.phantomsPerMin.toFixed(1)}/min, peak |yaw| ${calm.peakAbsYawDeg.toFixed(0)}°)\n`,
    );

    // The drill fires ~10-20 cues in 5 minutes. The detector inventing MORE turns than the player is
    // asked to make is what makes `scansDetected` untrustworthy today. Pin it so a fix has a bar to
    // beat and so it cannot silently regress.
    expect(typical.phantomsPerMin).toBeGreaterThan(10);
    expect(noisy.peakAbsYawDeg).toBeGreaterThan(DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg);
  });

  it('a TURNED player’s noise cannot reach the threshold at all (the control)', () => {
    // Same detector, same duration, but noise drawn from the side-on capture (σ ≈ 1.8°). If this
    // produced phantoms too, the threshold would be globally wrong — it does not, which localizes
    // the fault to the BACK-TURNED geometry, which is the one the drill actually stands in.
    const control = countPhantomScans(stillFor([TURNED_LEFT], 4));
    expect(control.phantomScans).toBe(0);
    expect(control.peakAbsYawDeg).toBeLessThan(DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg);
  });

  it('the shipped threshold also SHREDS a real turn, wrecking its reaction time', () => {
    const shipped = measureOnsetPrecision(realTurn, DEFAULT_SCAN_DETECT_CONFIG);

    // eslint-disable-next-line no-console
    console.log(
      `[onset precision] one real 133° half-turn, ${shipped.trials} traces, shipped threshold: ` +
        `clean detections ${shipped.cleanDetections}/${shipped.trials}, ` +
        `onset bias ${shipped.biasMs.toFixed(0)}ms, SD ${shipped.sdMs.toFixed(0)}ms\n`,
    );

    // The turn is 133° and unmissable, yet noise splits it into extra scans, so "exactly one scan,
    // correct direction" almost never happens...
    expect(shipped.cleanDetections).toBeLessThan(shipped.trials / 2);
    // ...and the onset it does report is timed with an SD comparable to a human reaction time
    // itself (~400-700ms), which means `reactionMs` currently carries no usable signal.
    expect(shipped.sdMs).toBeGreaterThan(300);
  });

  it('raising the threshold clear of the noise fixes BOTH failures at once', () => {
    const phantoms = countPhantomScans(stillFor(REAL_WINDOWS, 2), RAISED);
    const onset = measureOnsetPrecision(realTurn, RAISED);

    // eslint-disable-next-line no-console
    console.log(
      `[fix] yawEnterDeg ${DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg}° → ${RAISED.yawEnterDeg}°: ` +
        `phantoms ${phantoms.phantomsPerMin.toFixed(1)}/min, ` +
        `clean detections ${onset.cleanDetections}/${onset.trials}, ` +
        `onset SD ${onset.sdMs.toFixed(0)}ms\n`,
    );

    // The noise cannot reach 55°, so a motionless player is credited with nothing...
    expect(phantoms.phantomScans).toBe(0);
    // ...while a real 133° turn — which the drill REQUIRES, since you cannot read a screen behind
    // you without coming that far around — comes back as ONE clean scan in 38 of 40 traces, against
    // fewer than half at the shipped threshold. The 2 stragglers are still shredded by a noise spike
    // landing on the rising edge; tuned smoothing recovers them (next test), which is the whole
    // reason smoothing stays on the table.
    expect(onset.cleanDetections).toBeGreaterThanOrEqual(37);
    // And the onset is timed ~4x more precisely, which is what makes reactionMs mean anything.
    expect(onset.sdMs).toBeLessThan(150);
  });

  it('One-Euro at its DEFAULT tune makes phantoms WORSE — it must not be enabled naively', () => {
    const raw = countPhantomScans(stillFor([BACK_TURNED_NOISY], 1));
    const smoothed = countPhantomScans(
      stillFor([BACK_TURNED_NOISY], 1),
      DEFAULT_SCAN_DETECT_CONFIG,
      DEFAULT_ONE_EURO_CONFIG,
    );
    const onset = measureOnsetPrecision(realTurn, DEFAULT_SCAN_DETECT_CONFIG, DEFAULT_ONE_EURO_CONFIG);

    // eslint-disable-next-line no-console
    console.log(
      `[one-euro] DEFAULT tune (minCutoff ${DEFAULT_ONE_EURO_CONFIG.minCutoff}, beta ` +
        `${DEFAULT_ONE_EURO_CONFIG.beta}) on the shipped threshold: ` +
        `${raw.phantomScans} → ${smoothed.phantomScans} phantoms, onset SD ${onset.sdMs.toFixed(0)}ms\n`,
    );

    // Counterintuitive and important. Raw noise spikes are single-frame and die to the 150ms hold
    // debounce; SMOOTHING SPREADS THEM into sustained excursions that now satisfy the hold. So the
    // filter manufactures the very events it was reached for to suppress. Anyone who turns
    // DEFAULT_ONE_EURO_CONFIG on to "clean up" the yaw stream will make detection strictly worse,
    // and this test is here to stop them.
    expect(smoothed.phantomScans).toBeGreaterThan(raw.phantomScans);
    expect(onset.sdMs).toBeGreaterThan(500);
  });

  it('smoothing is only safe ON TOP OF a threshold that already clears the noise', () => {
    // Tuned in the Casiez order (docs/field-validation-protocol.md §10): beta = 0, then minCutoff
    // lowered against a STILL athlete's real capture until the jitter dies.
    const TUNED: OneEuroConfig = { minCutoff: 0.2, beta: 0, dCutoff: 1.0 };

    const bare = measureOnsetPrecision(realTurn, RAISED);
    const withEuro = measureOnsetPrecision(realTurn, RAISED, TUNED);
    const phantoms = countPhantomScans(stillFor(REAL_WINDOWS, 2), RAISED, TUNED);

    // eslint-disable-next-line no-console
    console.log(
      `[one-euro] TUNED (minCutoff ${TUNED.minCutoff}, beta ${TUNED.beta}) on the RAISED threshold: ` +
        `onset SD ${bare.sdMs.toFixed(0)}ms → ${withEuro.sdMs.toFixed(0)}ms, ` +
        `phantoms ${phantoms.phantomsPerMin.toFixed(1)}/min\n`,
    );

    // On a threshold the noise cannot reach, the same filter becomes a real precision win rather
    // than a phantom generator. Recorded as the tuned starting point for the smoothing decision —
    // still OFF by default; it needs its own field trace before it ships.
    expect(phantoms.phantomScans).toBe(0);
    expect(withEuro.cleanDetections).toBe(withEuro.trials);
    expect(withEuro.sdMs).toBeLessThan(bare.sdMs);
  });
});
