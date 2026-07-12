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
  /** Max yaw DRIFT (|median of 2nd half − median of 1st half|) across the
   * captured window (else: 'moving'). Drift is the movement test — it catches
   * an actual turn-in-progress while staying blind to zero-mean sensor jitter,
   * which at field distance is far larger than a still player's true motion. */
  maxDriftDeg: number;
  /** Sanity bound on yaw MAD (median absolute deviation) — generous, only to
   * reject windows where tracking itself is chaos (else: 'moving'). */
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

export const DEFAULT_AUTO_CAPTURE: AutoCaptureConfig = {
  armMs: 1400,
  maxGapMs: 900,
  minPresenceSamples: 8,
  minCaptureSamples: 5,
  maxDriftDeg: 6,
  maxMadDeg: 12,
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

/** Why a captured window was rejected — drives the targeted spoken retry line. */
export type CaptureFailReason = 'lost' | 'moving' | 'not_turned';

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
  /** Median face visibility — the back-vs-facing discriminator. */
  faceVisMedian: number;
}

export type CaptureValidation =
  | { ok: true; avgYawDeg: number; stats: CaptureStats }
  | { ok: false; reason: CaptureFailReason; stats: CaptureStats | null };

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Compute the robust window stats (exported for tests / diagnostics). */
export function captureStats(samples: readonly CaptureSample[]): CaptureStats {
  const yaws = samples.map((s) => s.yawDeg);
  const med = median(yaws);
  const madDeg = median(yaws.map((y) => Math.abs(y - med)));
  const half = Math.ceil(yaws.length / 2);
  const driftDeg = median(yaws.slice(half)) - median(yaws.slice(0, half));
  return {
    n: samples.length,
    medianDeg: med,
    madDeg,
    driftDeg,
    faceVisMedian: median(samples.map((s) => s.faceVis)),
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

  if (Math.abs(s.driftDeg) > cfg.maxDriftDeg || s.madDeg > cfg.maxMadDeg) {
    return { ok: false, reason: 'moving', stats: s };
  }

  if (phase === 'left') {
    if (baselineDeg == null) return { ok: false, reason: 'lost', stats: s };
    if (Math.abs(s.medianDeg - baselineDeg) < cfg.leftMinDeltaDeg) {
      return { ok: false, reason: 'not_turned', stats: s };
    }
  }
  return { ok: true, avgYawDeg: s.medianDeg, stats: s };
}
