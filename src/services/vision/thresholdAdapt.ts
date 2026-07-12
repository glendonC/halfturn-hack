/**
 * Per-player threshold adaptation — the fix for the phantom-scan finding.
 *
 * ## Why this exists
 *
 * `docs/scan-tracking-architecture.md` §10b/§10c: with the player's back to the camera — the ONLY
 * stance Turn & React uses — derived torso yaw carries σ ≈ 15-25°, and the shipped
 * `yawEnterDeg` is **28°**. The threshold sits inside the noise. Replaying the real captured noise
 * through the frozen detector (`analysis/phantomScans.ts`) measured the damage:
 *
 *   - a MOTIONLESS player is credited with **~21 phantom scans/min**;
 *   - a real 133° half-turn is SHREDDED into several scans, so its onset — and therefore
 *     `reactionMs` — is timed with **SD ±393 ms**, against a human reaction of ~400-700 ms.
 *
 * A single global constant cannot fix this, because the noise floor is a property of the PLAYER's
 * body, distance, and background: two real captures of the same athlete differed by 10° of σ.
 * So the threshold has to be derived from that athlete's own measured noise.
 *
 * ## The statistic
 *
 * Framing calibration already measures it and (until now) threw it away: `captureStats().sigmaDeg`,
 * a trend-blind successive-difference estimate of per-sample noise taken over the 3 s neutral hold.
 * That is exactly the quantity the threshold must clear. It is persisted on `CalibrationProfile`
 * as `neutralNoiseSigmaDeg`.
 *
 * ## Why the clamps are load-bearing, not decoration
 *
 * The obvious rule is `yawEnter = k · σ`. **It does not hold.** Fitting the minimum phantom-free
 * threshold against each real window's σ gives an implied k of **1.9 to 5.6** — because the clean
 * threshold tracks the noise's PEAK, and the peak-to-σ ratio is not constant across windows. So
 * `k · σ` is used only as a *scaling* term, and correctness comes from the bounds:
 *
 *   - **the floor** (`minYawEnterDeg`) is what actually guarantees the phantom-free property for a
 *     quiet calibration that under-states the noise the drill will really see;
 *   - **the cap** (`maxYawEnterDeg`) is what guarantees RECALL — it must stay well under the ~133°
 *     excursion a real half-turn produces, which the drill REQUIRES (you cannot read a screen
 *     behind you without coming that far around).
 *
 * The canyon between the noise peak (45°) and a real turn (133°) is what makes this safe at all.
 *
 * ## Contract
 *
 * Pure, closed-form, inspectable — one function of one measured statistic, under hard bounds. No
 * opaque model sits in the decision path (§8). A bad calibration can neither disable detection (the
 * cap) nor make it fire on noise (the floor). Every run records the `scanDetectConfig` it executed
 * under, so any capture can be re-derived and re-scored off-device.
 */

import { CUE_GATE } from '@/constants/visionTuning';

import {
  DEFAULT_SCAN_DETECT_CONFIG,
  type CalibrationProfile,
  type ScanDetectConfig,
} from './types';

export interface ThresholdPolicy {
  /** `yawEnter` scales with the player's measured neutral noise... */
  sigmaMultiplier: number;
  /** ...but the FLOOR is what makes it phantom-free. Real noise peaked at 45°. */
  minYawEnterDeg: number;
  /** ...and the CAP is what preserves recall. A real half-turn reaches ~133°. */
  maxYawEnterDeg: number;
  /** `yawExit` preserves the shipped hysteresis RATIO (15/28) rather than a fixed gap. */
  exitRatio: number;
  /** The cue gate's "back to neutral" band scales with the same noise... */
  neutralSigmaMultiplier: number;
  /** ...floored at today's value so a quiet calibration cannot tighten it. */
  minNeutralMaxYawDeg: number;
  /**
   * A player at "neutral" must never already be above the scan threshold, or the gate would wait
   * for a state the detector calls a turn. Enforced as a fraction of `yawEnterDeg`.
   */
  maxNeutralFractionOfEnter: number;
}

/**
 * Fitted against the real captured windows (σ 14.9° and 24.5°), then verified end-to-end on the
 * phantom-scan replay: every σ in the measured range lands on a config with ZERO phantoms and full
 * recall of a real turn. See `__tests__/thresholdAdapt.test.ts`, which proves exactly that rather
 * than asserting the constants.
 */
export const DEFAULT_THRESHOLD_POLICY: ThresholdPolicy = {
  sigmaMultiplier: 3.5,
  minYawEnterDeg: 45,
  maxYawEnterDeg: 70,
  exitRatio: DEFAULT_SCAN_DETECT_CONFIG.yawExitDeg / DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg,
  neutralSigmaMultiplier: 2.0,
  minNeutralMaxYawDeg: CUE_GATE.neutralMaxYawDeg,
  maxNeutralFractionOfEnter: 0.6,
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);

/** True when the calibration carries a usable measured noise floor. */
export function hasNoiseFloor(calib: CalibrationProfile): boolean {
  const s = calib.neutralNoiseSigmaDeg;
  return typeof s === 'number' && Number.isFinite(s) && s >= 0;
}

/**
 * Derive this player's scan-detection thresholds from their measured neutral noise.
 *
 * Falls back to `base` UNCHANGED when the calibration predates the noise-floor measurement, so an
 * old profile keeps today's exact behavior rather than silently getting a guessed threshold.
 */
export function deriveScanDetectConfig(
  base: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  calib: CalibrationProfile,
  policy: ThresholdPolicy = DEFAULT_THRESHOLD_POLICY,
): ScanDetectConfig {
  if (!hasNoiseFloor(calib)) return base;

  const sigma = calib.neutralNoiseSigmaDeg as number;
  const yawEnterDeg = clamp(
    policy.sigmaMultiplier * sigma,
    policy.minYawEnterDeg,
    policy.maxYawEnterDeg,
  );

  return {
    ...base,
    yawEnterDeg,
    // Ratio, not gap: a 55° enter with the shipped 15° exit would demand the player return almost
    // to dead-neutral to close a scan, which their own noise would prevent.
    yawExitDeg: yawEnterDeg * policy.exitRatio,
  };
}

/**
 * Derive the cue gate's "player is back at neutral" band from the same statistic.
 *
 * The gate holds a due cue until the player has RESET (`isReadyForCue`). Its shipped band is 20°,
 * narrower than the measured noise, so only ~61% of a MOTIONLESS player's samples read "neutral".
 *
 * ⚠️ This is a CONSISTENCY change, not a bug fix — be honest about which. The obvious guess is that
 * the narrow band stalls the drill; it does not. `isReadyForCue` needs only one neutral sample
 * inside `staleAfterMs` (~9 samples), and at 61% per sample essentially every window has one:
 * measured, a due cue is held 0% of the time under both the fixed and the widened band. The band is
 * scaled anyway so that "at neutral" and "is turning" stay defined against the SAME noise floor the
 * scan thresholds now use — two thresholds on one signal should not disagree about what still means.
 */
export function deriveNeutralMaxYawDeg(
  calib: CalibrationProfile,
  scan: ScanDetectConfig,
  policy: ThresholdPolicy = DEFAULT_THRESHOLD_POLICY,
): number {
  if (!hasNoiseFloor(calib)) return CUE_GATE.neutralMaxYawDeg;

  const sigma = calib.neutralNoiseSigmaDeg as number;
  return clamp(
    policy.neutralSigmaMultiplier * sigma,
    policy.minNeutralMaxYawDeg,
    // Never let "at neutral" overlap "is turning".
    policy.maxNeutralFractionOfEnter * scan.yawEnterDeg,
  );
}
