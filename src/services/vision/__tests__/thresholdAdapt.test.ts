import { CUE_GATE, isReadyForCue } from '@/constants/visionTuning';
import { mulberry32 } from '@/utils/random';

import {
  BACK_TURNED_ACCEPTED,
  BACK_TURNED_NOISY,
} from '../__fixtures__/realFramingCaptures';
import {
  countPhantomScans,
  measureOnsetPrecision,
  stationaryStream,
  turnTrace,
} from '../analysis/phantomScans';
import { captureStats } from '../framingAutoCapture';
import {
  DEFAULT_THRESHOLD_POLICY,
  deriveNeutralMaxYawDeg,
  deriveScanDetectConfig,
  hasNoiseFloor,
} from '../thresholdAdapt';
import { DEFAULT_CALIBRATION, DEFAULT_SCAN_DETECT_CONFIG, type CalibrationProfile } from '../types';

/**
 * The phantom-scan fix (docs/scan-tracking-architecture.md §10c).
 *
 * The point of these tests is NOT to assert the policy constants back at themselves — that would
 * only prove arithmetic. It is to run the derivation END-TO-END on the REAL captured noise:
 *
 *   real captured window  →  captureStats().sigmaDeg  (what framing persists)
 *                         →  deriveScanDetectConfig    (what the drill would run)
 *                         →  replay through the frozen detector
 *                         →  ZERO phantoms, and a real turn still found
 *
 * If the policy is ever retuned and stops clearing the real noise, these fail.
 */

const profileWith = (sigma: number): CalibrationProfile => ({
  ...DEFAULT_CALIBRATION,
  neutralNoiseSigmaDeg: sigma,
});

/** The σ framing would actually persist for a given real capture. */
const sigmaOfRealCapture = (window: readonly number[]): number => {
  const stats = captureStats(
    window.map((yawDeg, i) => ({ tMs: i * 100, yawDeg, confidence: 0.9, faceVis: 0.9 })),
  );
  return stats.sigmaDeg;
};

const REAL_WINDOWS = [BACK_TURNED_NOISY, BACK_TURNED_ACCEPTED];

describe('per-player threshold adaptation', () => {
  describe('the derivation itself', () => {
    it('leaves an OLD profile (no measured noise floor) byte-identical to today', () => {
      // The whole point of the field being optional: a profile captured before the noise floor was
      // ever measured must keep today's exact behavior rather than get a guessed threshold.
      expect(hasNoiseFloor(DEFAULT_CALIBRATION)).toBe(false);
      expect(deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, DEFAULT_CALIBRATION)).toEqual(
        DEFAULT_SCAN_DETECT_CONFIG,
      );
      expect(deriveNeutralMaxYawDeg(DEFAULT_CALIBRATION, DEFAULT_SCAN_DETECT_CONFIG)).toBe(
        CUE_GATE.neutralMaxYawDeg,
      );
    });

    it('scales the threshold with the player’s noise, under a floor and a cap', () => {
      const quiet = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, profileWith(2));
      const mid = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, profileWith(15));
      const loud = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, profileWith(40));

      // A suspiciously quiet calibration cannot drop the threshold back into the noise the drill
      // will really see — the FLOOR is what makes the phantom-free property hold, not k·σ.
      expect(quiet.yawEnterDeg).toBe(DEFAULT_THRESHOLD_POLICY.minYawEnterDeg);
      // In between, it tracks the player's own noise.
      expect(mid.yawEnterDeg).toBeCloseTo(15 * DEFAULT_THRESHOLD_POLICY.sigmaMultiplier);
      // And a terrible calibration cannot raise it so far that a real turn stops registering — the
      // CAP is what protects recall.
      expect(loud.yawEnterDeg).toBe(DEFAULT_THRESHOLD_POLICY.maxYawEnterDeg);
    });

    it('carries the hysteresis as a RATIO, never as the shipped fixed gap', () => {
      const cfg = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, profileWith(20));
      // A 70° enter with the shipped 15° exit would demand the player return almost to dead-neutral
      // to close a scan — which their own noise (σ 20°) would prevent, so the scan would never end.
      expect(cfg.yawExitDeg / cfg.yawEnterDeg).toBeCloseTo(
        DEFAULT_SCAN_DETECT_CONFIG.yawExitDeg / DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg,
      );
      expect(cfg.yawExitDeg).toBeGreaterThan(DEFAULT_SCAN_DETECT_CONFIG.yawExitDeg);
    });

    it('never lets "at neutral" overlap "is turning"', () => {
      // If the cue gate's neutral band reached the scan threshold, a player could be simultaneously
      // ready for the next cue and mid-scan. Check it holds across the whole plausible σ range.
      for (let sigma = 0; sigma <= 60; sigma += 1) {
        const calib = profileWith(sigma);
        const scan = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, calib);
        const band = deriveNeutralMaxYawDeg(calib, scan);
        expect(band).toBeLessThan(scan.yawEnterDeg);
        expect(band).toBeGreaterThanOrEqual(CUE_GATE.neutralMaxYawDeg);
      }
    });

    it('leaves the fixed cue gate unchanged when it is not adapting', () => {
      const still = { tMonoMs: 1000, yawDeg: 18, confidence: 0.9 };
      expect(isReadyForCue(still, 1000)).toBe(true); // 18° < the fixed 20° band
      const turning = { tMonoMs: 1000, yawDeg: 25, confidence: 0.9 };
      expect(isReadyForCue(turning, 1000)).toBe(false);
      // ...but a player whose own noise is 25° is NOT turning at 25°, and the widened band knows it.
      expect(isReadyForCue(turning, 1000, 40)).toBe(true);
    });
  });

  describe('END-TO-END on the real captured noise (the thing that actually matters)', () => {
    it.each([
      ['BACK_TURNED_NOISY', BACK_TURNED_NOISY],
      ['BACK_TURNED_ACCEPTED', BACK_TURNED_ACCEPTED],
    ])(
      'a config derived from %s kills every phantom scan a still player produces',
      (_name, window) => {
        // Exactly the path the app takes: framing measures σ, persists it, the drill derives from it.
        const sigma = sigmaOfRealCapture(window);
        const calib = profileWith(sigma);
        const cfg = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, calib);

        const still = stationaryStream({
          realYawWindows: [window],
          durationSec: 300,
          rng: mulberry32(11),
        });
        const before = countPhantomScans(still, DEFAULT_SCAN_DETECT_CONFIG);
        const after = countPhantomScans(still, cfg);

        // eslint-disable-next-line no-console
        console.log(
          `[adapt] ${_name}: measured σ=${sigma.toFixed(1)}° ⇒ yawEnter ` +
            `${DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg}° → ${cfg.yawEnterDeg.toFixed(0)}°; ` +
            `phantoms ${before.phantomsPerMin.toFixed(1)}/min → ${after.phantomsPerMin.toFixed(1)}/min`,
        );

        expect(after.phantomScans).toBe(0);
      },
    );

    it('and still finds a real half-turn, timed far more precisely', () => {
      const sigma = Math.max(...REAL_WINDOWS.map(sigmaOfRealCapture));
      const cfg = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, profileWith(sigma));

      const makeTurn = (seed: number) =>
        turnTrace({ realYawWindows: REAL_WINDOWS, rng: mulberry32(200 + seed) });

      const before = measureOnsetPrecision(makeTurn, DEFAULT_SCAN_DETECT_CONFIG);
      const after = measureOnsetPrecision(makeTurn, cfg);

      // eslint-disable-next-line no-console
      console.log(
        `[adapt] real 133° half-turn: clean detections ${before.cleanDetections}/${before.trials} → ` +
          `${after.cleanDetections}/${after.trials}; onset SD ±${before.sdMs.toFixed(0)}ms → ` +
          `±${after.sdMs.toFixed(0)}ms\n`,
      );

      // A raised threshold that killed real turns would be no fix at all. The drill REQUIRES a big
      // turn — you cannot read a screen behind you without one — which is exactly why this is safe.
      expect(after.cleanDetections).toBeGreaterThan(before.cleanDetections);
      expect(after.cleanDetections).toBeGreaterThanOrEqual(0.9 * after.trials);
      // And the onset gets precise enough for reactionMs to carry signal at all (§10c: the shipped
      // config times it with SD ±393ms, against a human reaction of ~400-700ms).
      expect(after.sdMs).toBeLessThan(150);
    });

    it('widens the cue gate to match — though the gate was NOT the thing that was broken', () => {
      const sigma = sigmaOfRealCapture(BACK_TURNED_NOISY);
      const calib = profileWith(sigma);
      const cfg = deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, calib);
      const band = deriveNeutralMaxYawDeg(calib, cfg);

      const still = stationaryStream({
        realYawWindows: [BACK_TURNED_NOISY],
        durationSec: 60,
        rng: mulberry32(12),
      });
      const ready = (b: number) => still.map((s) => isReadyForCue(s, s.tMonoMs, b));

      /**
       * The number that actually decides whether the drill feels broken. A cue comes due at some
       * arbitrary moment; `isReadyForCue` also demands a sample no older than `staleAfterMs`, so the
       * cue fires iff SOME sample in that trailing window reads neutral. Sweep every possible due
       * moment and ask how often the cue would have been held.
       */
      const heldRate = (b: number) => {
        const flags = ready(b);
        const span = Math.round(CUE_GATE.staleAfterMs / 100); // 100ms sample period
        let held = 0;
        let n = 0;
        for (let i = span; i < flags.length; i += 1) {
          n += 1;
          if (!flags.slice(i - span, i + 1).some(Boolean)) held += 1;
        }
        return n > 0 ? held / n : 0;
      };

      const fixedReady = ready(CUE_GATE.neutralMaxYawDeg).filter(Boolean).length / still.length;
      const adaptedReady = ready(band).filter(Boolean).length / still.length;
      const fixedHeld = heldRate(CUE_GATE.neutralMaxYawDeg);
      const adaptedHeld = heldRate(band);

      // eslint-disable-next-line no-console
      console.log(
        `[adapt] cue gate on a MOTIONLESS player: band ${CUE_GATE.neutralMaxYawDeg}° → ${band.toFixed(0)}°; ` +
          `samples reading "neutral" ${(fixedReady * 100).toFixed(0)}% → ${(adaptedReady * 100).toFixed(0)}%; ` +
          `due cues that would be HELD ${(fixedHeld * 100).toFixed(1)}% → ${(adaptedHeld * 100).toFixed(1)}%\n`,
      );

      // The fixed 20° band IS narrower than the player's own noise: only ~61% of a motionless
      // player's samples read "back at neutral".
      expect(fixedReady).toBeLessThan(0.7);
      expect(adaptedReady).toBeGreaterThan(fixedReady);

      // ⚠️ But it does NOT stall the drill, and it is worth being precise about why, because the
      // opposite was the obvious guess. `isReadyForCue` needs only ONE neutral sample inside its
      // `staleAfterMs` (800ms ⇒ ~9 samples) window, and at a 61% per-sample rate essentially every
      // window contains one. Measured: a due cue is held 0% of the time under BOTH bands. So the
      // widening is a CONSISTENCY change — the neutral band should scale with the same noise the
      // scan thresholds now scale with — not a fix for an observed stall. Pinned so the claim
      // cannot quietly grow back.
      expect(fixedHeld).toBe(0);
      expect(adaptedHeld).toBe(0);
    });
  });
});
