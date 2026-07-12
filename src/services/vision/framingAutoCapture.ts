/**
 * Auto-capture logic for the framing flow — pure + dependency-free, like
 * `scanDetect`, so the rules are unit-testable with synthetic traces.
 *
 * The player calibrates 2–4 m from a mounted phone with their back to it, so a
 * tapped capture is physically out of reach and on-screen feedback is
 * invisible. Design principle: DETECT what is robust, VALIDATE what is not.
 *
 *   1. PRESENCE (robust) arms the capture: the player has been in frame for
 *      the arm period, dropout-tolerant. No stillness required — derived yaw
 *      is far too noisy at field distance for a pre-trigger stillness gate
 *      (the failed first design: a "hold still to start" gate that field noise
 *      kept unpassable).
 *   2. A spoken COUNTDOWN gives the player an exact moment to freeze.
 *   3. VALIDATION runs on the captured window after the fact, where the data
 *      is complete: sample count, movement (σ of yaw), and — for LEFT — the
 *      turn delta vs the neutral baseline. Failures carry a REASON so the
 *      coach can say exactly what to fix, eyes-off.
 */

import { wrapDeg180 } from './YawFusion';

/** One in-frame observation (wall-clock ms + derived torso yaw). */
export interface AutoCaptureSample {
  tMs: number;
  yawDeg: number;
}

export interface AutoCaptureConfig {
  /** How long the player must be (roughly) continuously in frame to arm. */
  armMs: number;
  /** Max dropout between sightings (and last→now) inside the arm window. */
  maxGapMs: number;
  /** Minimum sightings the arm window must contain (guards a sparse feed). */
  minPresenceSamples: number;
  /** Minimum in-frame samples a capture must average (else: 'lost'). */
  minCaptureSamples: number;
  /**
   * ABSOLUTE floor for the drift test, degrees. A drift must clear BOTH this and the
   * noise-relative bound below to count as movement — the floor is what catches a slow, real
   * turn on a clean signal (where the noise bound would be near zero).
   */
  maxDriftDeg: number;
  /**
   * How many standard errors of drift-under-noise a drift must exceed to be called movement.
   *
   * ⚠️ FIELD-MEASURED, do not revert to a fixed threshold. The old fixed `maxDriftDeg: 8` was
   * SMALLER than the drift that pure sensor noise produces back-to-camera (measured SE ≈ 13.6°
   * at 2–4 m), so it fired on noise alone and told a motionless player they had moved. Drift is
   * only evidence of movement when it is large *relative to how noisy this particular read is*.
   */
  driftSigmas: number;
  /**
   * Max acceptable standard error of the resulting neutral BASELINE, degrees (else 'unstable').
   *
   * This replaces a raw MAD threshold because the baseline's precision is the thing that
   * actually matters: its error biases every `yawDeg` in the drill that follows. It also scales
   * correctly with sample count — a noisy read is fine if we averaged enough frames, which is
   * exactly the lever `FRAMING_CAPTURE_MS` pulls.
   */
  maxBaselineSeDeg: number;
  /** Chaos ceiling on raw yaw MAD — a read this scattered has no usable median at any n. */
  maxMadDeg: number;
  /** LEFT only: min |capture mean − neutral baseline| (else: 'not_turned').
   * Sign-agnostic — `resolveYawSign` owns which rotation is "left". */
  leftMinDeltaDeg: number;
  /** Refractory after any capture ends before presence can re-arm. */
  rearmMs: number;
}

/*
 * There is deliberately NO facing (front-vs-back) check, although calibrating
 * while facing the camera and then training back-turned would invert the yaw
 * sign. A faceVis-based guard was built and field-measured: MediaPipe reports
 * anterior-face visibility of 0.92–0.99 with the player's BACK fully turned
 * (visibility is hallucinated for occluded landmarks), so no threshold
 * separates the stances — the guard rejected honest back-turned captures.
 * Stance consistency is coached by the spoken instructions instead; the yaw
 * sign is self-consistent as long as the player calibrates in the stance they
 * train in. faceVis stays in CaptureStats/logs as research data only.
 */

/**
 * ⚠️ THE BACK-TURNED NOISE FLOOR (field-measured on an iPhone at ~3 m, pose lite).
 *
 * Derived torso yaw is an order of magnitude noisier when the player's BACK is to the camera
 * than when they are turned, because MediaPipe cannot see the chest and its world-z for a
 * back-on torso is barely constrained. Measured on one athlete, same distance and light:
 *
 *   back-to-camera (the drill's neutral stance):  MAD  8–17°   (σ ≈ 8–21°)
 *   turned to the side:                           MAD  1.0°    (σ ≈ 1.0°)
 *
 * Every threshold in this file used to be a guess that sat ON that noise floor
 * (`maxMadDeg: 15`, `maxDriftDeg: 8`), so calibration was a coin flip and blamed the player for
 * jitter they did not cause. The constants below are set FROM those measurements, and the drift
 * test is now noise-relative rather than absolute.
 *
 * This also has a consequence far beyond framing, recorded here because this is where the
 * number was measured: `DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg` is 28°, only ~1–2σ above the
 * neutral noise — so a motionless player can cross the scan threshold on noise alone. See
 * docs/scan-tracking-architecture.md.
 */
export const DEFAULT_AUTO_CAPTURE: AutoCaptureConfig = {
  armMs: 1400,
  maxGapMs: 900,
  minPresenceSamples: 8,
  minCaptureSamples: 5,
  maxDriftDeg: 8,
  driftSigmas: 3,
  maxBaselineSeDeg: 6, // ≈ 20% of yawEnterDeg — the most baseline bias the drill can absorb
  maxMadDeg: 30, // chaos ceiling only; the real gate is maxBaselineSeDeg
  leftMinDeltaDeg: 25,
  rearmMs: 2000,
};

/**
 * Append a sighting and prune the window to what presence can ever need
 * (arm period + slack so the coverage check can pass). Returns a new array.
 */
export function appendSample(
  samples: readonly AutoCaptureSample[],
  sample: AutoCaptureSample,
  cfg: AutoCaptureConfig = DEFAULT_AUTO_CAPTURE,
): AutoCaptureSample[] {
  const cutoff = sample.tMs - cfg.armMs - 600;
  return [...samples.filter((s) => s.tMs >= cutoff), sample];
}

export interface PresenceQuery {
  /** Rolling window of IN-FRAME sightings only (see `appendSample`). */
  samples: readonly AutoCaptureSample[];
  nowMs: number;
  /** Earliest time arming is allowed (refractory after captures). */
  armedAtMs: number;
  cfg?: AutoCaptureConfig;
}

/** True when the player has been solidly in frame long enough to start the countdown. */
export function isPresent({
  samples,
  nowMs,
  armedAtMs,
  cfg = DEFAULT_AUTO_CAPTURE,
}: PresenceQuery): boolean {
  if (nowMs < armedAtMs) return false;
  if (samples.length < cfg.minPresenceSamples) return false;
  if (samples[0].tMs > nowMs - cfg.armMs) return false;
  let prev = samples[0].tMs;
  for (const s of samples) {
    if (s.tMs - prev > cfg.maxGapMs) return false;
    prev = s.tMs;
  }
  return nowMs - prev <= cfg.maxGapMs;
}

/**
 * Why a captured window was rejected — drives the targeted spoken retry line.
 *
 * `moving` and `unstable` are deliberately SEPARATE, because they are different physical
 * causes with different fixes and only one of them is the player's fault:
 *   - `moving`   — the yaw genuinely DRIFTED across the window: the player rotated during the
 *                  hold. "Freeze until the beep" is the right coaching.
 *   - `unstable` — the yaw signal is CHAOTIC: the tracker cannot hold a steady read (distance,
 *                  light, background, or MediaPipe flipping its front/back interpretation).
 *                  The player is often perfectly still. Telling them to "hold stiller" is
 *                  unactionable and they will fail again — which is exactly what happened when
 *                  these two shared the `moving` label.
 */
export type CaptureFailReason = 'lost' | 'moving' | 'unstable' | 'not_turned';

/** One in-frame observation collected during a capture window. */
export interface CaptureSample {
  yawDeg: number;
  /** Mean anterior-face-landmark visibility (high ⇒ facing the camera). */
  faceVis: number;
}

/** Robust window statistics — always returned so the field can be TUNED from
 * logged reality instead of guessed thresholds. */
export interface CaptureStats {
  n: number;
  medianDeg: number;
  /** Median absolute deviation — spread that ignores single-frame spikes. */
  madDeg: number;
  /** median(2nd half) − median(1st half): signed turn-in-progress estimate. */
  driftDeg: number;
  /** Median face visibility — hallucinated for occluded landmarks; research data only. */
  faceVisMedian: number;

  /**
   * Per-frame noise σ, estimated from SUCCESSIVE differences rather than from the spread about
   * the median.
   *
   * ⚠️ This distinction is load-bearing. MAD measures TOTAL spread, so a steadily turning player
   * inflates their own MAD — and a drift test scaled by that inflated noise would then excuse
   * the very turn it exists to catch. Successive differences are blind to a smooth trend (a
   * constant ramp has constant, small deltas) and sensitive to jitter, which is exactly the
   * separation we need.
   */
  sigmaDeg: number;
  /** Standard error of the captured baseline (the median). This is what `maxBaselineSeDeg` gates. */
  baselineSeDeg: number;
  /** Standard error of `driftDeg` under pure noise — the scale the drift test measures against. */
  driftSeDeg: number;

  // --- Axial (mod-180) diagnostics: MEASURED ONLY, they gate nothing yet ---
  /**
   * Spread about the torso AXIS, ignoring which end of it the tracker chose (0..90).
   * See {@link flipRate} — read the two together.
   */
  axialMadDeg: number;
  /**
   * Fraction of frames (0..0.5) on the minority end of the torso axis.
   *
   * MediaPipe can flip its front/back interpretation of a back-turned body between frames,
   * which swings `torsoYawDeg` by ~180°. A circular mean of such a stream is meaningless (the
   * two modes cancel), so `madDeg` explodes and the capture gets blamed on the player for
   * "moving". Doubling the angle collapses that ambiguity, so:
   *   - `flipRate ≈ 0` + high `madDeg`  ⇒ genuine jitter/noise.
   *   - `flipRate` high + LOW `axialMadDeg` ⇒ the player was rock still and the TRACKER flipped.
   *
   * FIELD RESULT: measured `flipRate = 0%` on every capture — MediaPipe does NOT flip its
   * front/back read. The back-turned noise is ordinary jitter, not an interpretation flip. Kept
   * as a diagnostic so the hypothesis stays cheap to re-falsify if the geometry ever changes.
   */
  flipRate: number;
}

export type CaptureValidation =
  | { ok: true; avgYawDeg: number; stats: CaptureStats }
  | { ok: false; reason: CaptureFailReason; stats: CaptureStats | null };

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Per-frame noise σ from the median of the WRAPPED SUCCESSIVE differences.
 *
 * Trend-blind by construction: a player turning at a constant rate produces constant, small
 * successive deltas, so their noise estimate stays low and their drift remains detectable. A MAD
 * about the median would instead be inflated by the turn itself — and a drift test scaled by
 * that inflated noise would excuse the very movement it exists to catch.
 */
function successiveDiffSigmaDeg(yaws: readonly number[]): number {
  if (yaws.length < 2) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < yaws.length; i += 1) {
    diffs.push(Math.abs(wrapDeg180(yaws[i] - yaws[i - 1])));
  }
  // 1.4826 makes a MAD a consistent σ estimator for a normal; differencing doubles the variance,
  // so divide by √2 to recover the per-sample σ.
  return (1.4826 * median(diffs)) / Math.SQRT2;
}

/**
 * Fold an angle difference to (−90, 90] — treats θ and θ+180 as the SAME axis. This is what
 * makes the stats blind to the tracker's front/back choice while staying sensitive to real
 * rotation about that axis.
 */
function foldDeg90(deltaDeg: number): number {
  const d = wrapDeg180(deltaDeg);
  if (d > 90) return d - 180;
  if (d <= -90) return d + 180;
  return d;
}

/**
 * Compute the robust window stats (exported for tests / diagnostics).
 *
 * CIRCULAR: yaw is an angle and the back-turned stance sits at the ±180° seam,
 * so all spread/drift math runs on wrapped deltas from the window's circular
 * mean — a still player straddling the seam otherwise reads as MAD ≈ 170°
 * (field-measured before this fix: "drift −334°" on a motionless capture).
 */
export function captureStats(samples: readonly CaptureSample[]): CaptureStats {
  let sinSum = 0;
  let cosSum = 0;
  for (const s of samples) {
    const rad = (s.yawDeg * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  const refDeg = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;

  const deltas = samples.map((s) => wrapDeg180(s.yawDeg - refDeg));
  const deltaMed = median(deltas);
  const madDeg = median(deltas.map((d) => Math.abs(d - deltaMed)));
  const half = Math.ceil(deltas.length / 2);
  const driftDeg = median(deltas.slice(half)) - median(deltas.slice(0, half));

  // Axial pass: double the angles so θ and θ+180 coincide, then take the circular mean. This
  // survives a stream where the tracker keeps flipping which way the body faces — the case the
  // ordinary circular mean above degenerates on (the two modes cancel to a garbage reference,
  // which then inflates madDeg and gets misread as player movement).
  let sin2 = 0;
  let cos2 = 0;
  for (const s of samples) {
    const rad2 = (2 * s.yawDeg * Math.PI) / 180;
    sin2 += Math.sin(rad2);
    cos2 += Math.cos(rad2);
  }
  const axisDeg = ((Math.atan2(sin2, cos2) * 180) / Math.PI) / 2;
  const axialDeltas = samples.map((s) => foldDeg90(s.yawDeg - axisDeg));
  const axialMed = median(axialDeltas);
  const axialMadDeg = median(axialDeltas.map((d) => Math.abs(d - axialMed)));

  // How many frames sit on the far end of that axis (i.e. the tracker read the body as facing
  // the other way). The minority share is the flip rate; 0 means it never changed its mind.
  let minority = 0;
  for (const s of samples) {
    if (Math.abs(wrapDeg180(s.yawDeg - axisDeg)) > 90) minority += 1;
  }
  const n = samples.length;
  const flipRate = n > 0 ? Math.min(minority, n - minority) / n : 0;

  // Noise → precision. 1.2533 (= √(π/2)) converts a mean's standard error into a MEDIAN's.
  // driftDeg is a difference of two half-window medians, so its SE is √2 · (SE of a median over
  // n/2 samples), which reduces exactly to 2× the full-window baseline SE.
  const sigmaDeg = successiveDiffSigmaDeg(samples.map((s) => s.yawDeg));
  const baselineSeDeg = n > 0 ? (1.2533 * sigmaDeg) / Math.sqrt(n) : Infinity;
  const driftSeDeg = 2 * baselineSeDeg;

  return {
    n,
    medianDeg: wrapDeg180(refDeg + deltaMed),
    madDeg,
    driftDeg,
    faceVisMedian: median(samples.map((s) => s.faceVis)),
    sigmaDeg,
    baselineSeDeg,
    driftSeDeg,
    axialMadDeg,
    flipRate,
  };
}

/**
 * Judge a completed capture from its collected in-frame samples. Pure: every
 * rejection names the player-fixable cause. All statistics are robust
 * (median/MAD) because per-frame yaw carries heavy-tailed sensor spikes that a
 * mean/σ would misread as player movement.
 */
export function validateCapture(
  samples: readonly CaptureSample[],
  phase: 'center' | 'left',
  baselineDeg: number | null,
  cfg: AutoCaptureConfig = DEFAULT_AUTO_CAPTURE,
): CaptureValidation {
  const stats = samples.length > 0 ? captureStats(samples) : null;
  if (samples.length < cfg.minCaptureSamples) return { ok: false, reason: 'lost', stats };
  const s = stats as CaptureStats;

  // Order matters: an unusable READ is decided first. If the signal cannot pin a baseline, then
  // `driftDeg` is a difference of two medians drawn from the same noise, and reporting "you
  // moved" off it is a coin flip dressed up as coaching. An unstable read is a setup problem,
  // not a player problem, and it gets its own reason so the spoken line names a fix they can act on.
  if (s.madDeg > cfg.maxMadDeg || s.baselineSeDeg > cfg.maxBaselineSeDeg) {
    return { ok: false, reason: 'unstable', stats: s };
  }

  // Movement is only movement when the drift is large RELATIVE TO THIS READ'S OWN NOISE. The
  // absolute floor still catches a slow, genuine turn on a clean signal (where the noise bound
  // collapses toward zero). Field-measured: back-to-camera, noise alone produces a drift SE of
  // ~13°, so the old fixed 8° bound was below the noise and blamed still players for moving.
  const driftLimitDeg = Math.max(cfg.maxDriftDeg, cfg.driftSigmas * s.driftSeDeg);
  if (Math.abs(s.driftDeg) > driftLimitDeg) {
    return { ok: false, reason: 'moving', stats: s };
  }

  if (phase === 'left') {
    if (baselineDeg == null) return { ok: false, reason: 'lost', stats: s };
    if (Math.abs(wrapDeg180(s.medianDeg - baselineDeg)) < cfg.leftMinDeltaDeg) {
      return { ok: false, reason: 'not_turned', stats: s };
    }
  }
  return { ok: true, avgYawDeg: s.medianDeg, stats: s };
}
