/**
 * One-Euro filter (Casiez, Roussel & Vogel, CHI 2012) — a speed-adaptive low-pass
 * for the noisy yaw signal. Pure + dependency-free (timestamps are passed IN, no
 * Date.now), so it is fully unit-testable with synthetic traces and safe to import
 * anywhere, including the Expo-Go graph.
 *
 * WHY this and not a fixed EMA or a Kalman (see docs/scan-tracking-architecture.md §2/§4):
 * a first-order low-pass has DC group delay = 1/(2·pi·f_c) SECONDS, independent of
 * sample rate. A fixed EMA tuned to remove neutral jitter (f_c ~ 1 Hz) therefore lags
 * the yaw PEAK by ~159 ms (~2.4 frames at 15 fps) and misplaces reaction time; a
 * predictive Kalman claws back lag but OVERSHOOTS at the sharp turn onset/peak — the
 * exact moment that defines direction and reaction. One-Euro raises its cutoff with
 * angular speed, so it filters hard when still yet delays the fast peak only ~30–80 ms
 * (<1 frame), with two intuitive params and trivial compute.
 *
 * NOT YET WIRED into the live fusion path — provided as a tested primitive for
 * YawFusion to adopt after the mincutoff/beta are tuned on-device (Casiez order:
 * set beta = 0, tune mincutoff on a still athlete, then raise beta on turns).
 */

/** One-pole exponential low-pass with an externally supplied smoothing factor. */
class LowPass {
  private hatXPrev: number | null = null;
  private initialized = false;

  /** Filter a value with smoothing factor `alpha` in (0, 1]. */
  filter(x: number, alpha: number): number {
    const hatX = this.initialized ? alpha * x + (1 - alpha) * (this.hatXPrev as number) : x;
    this.hatXPrev = hatX;
    this.initialized = true;
    return hatX;
  }

  get lastValue(): number | null {
    return this.hatXPrev;
  }

  reset(): void {
    this.hatXPrev = null;
    this.initialized = false;
  }
}

export interface OneEuroConfig {
  /**
   * Minimum cutoff frequency (Hz). Governs smoothing when the signal is slow/still —
   * lower = smoother/laggier at rest. Yaw-in-degrees at 15 fps: ~0.8–1.2 Hz.
   */
  minCutoff: number;
  /**
   * Speed coefficient. Higher = less lag (more responsive) during fast motion.
   * Yaw at 15 fps: ~0.01–0.02 (dyaw/dt is in deg/s, so beta is small).
   */
  beta: number;
  /** Cutoff (Hz) for the derivative's own low-pass. Typically 1.0. */
  dCutoff: number;
}

/**
 * The library's generic starting point — NOT a tune for this signal.
 *
 * ⚠️ Applied to the DETECTION stream at the shipped scan threshold, this config makes detection
 * strictly WORSE: phantom scans 181 → 291 and onset SD ±1283 ms, measured against real captured
 * noise (docs/scan-tracking-architecture.md §10c). The mechanism is the opposite of the intuition
 * that reaches for a filter: raw noise spikes are single-frame and die to the 150 ms hold debounce,
 * while smoothing SPREADS them into sustained excursions that then satisfy the hold. Use
 * `TUNED_ONE_EURO_CONFIG` for the detection stream.
 */
export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1.0,
  beta: 0.015,
  dCutoff: 1.0,
};

/**
 * Tuned against the REAL captured back-turned traces in the Casiez order
 * (docs/field-validation-protocol.md §10): beta = 0, then `minCutoff` lowered against a STILL
 * athlete's capture until the jitter dies.
 *
 * Only safe ON TOP OF a scan threshold the noise cannot already reach (see `thresholdAdapt.ts`).
 * There it is a genuine precision win: onset SD 93 → 60 ms with zero phantoms and full recall.
 * Still opt-in (`EXPO_PUBLIC_SMOOTH`) pending its own field trace.
 */
export const TUNED_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 0.2,
  beta: 0,
  dCutoff: 1.0,
};

/** Smoothing factor for cutoff frequency `fc` (Hz) over a timestep `dt` (seconds). */
function smoothingFactor(dtSec: number, fcHz: number): number {
  const tau = 1 / (2 * Math.PI * fcHz);
  return 1 / (1 + tau / dtSec);
}

/**
 * Speed-adaptive scalar filter. Feed monotonically increasing timestamps (ms). The
 * first sample passes through unchanged (no history); subsequent samples adapt their
 * cutoff to the estimated rate of change. If two samples share a timestamp the second
 * is returned unfiltered (dt = 0 is undefined) to stay deterministic and NaN-free.
 */
export class OneEuroFilter {
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private lastTimeMs: number | null = null;
  private lastRawX: number | null = null;

  constructor(private readonly cfg: OneEuroConfig = DEFAULT_ONE_EURO_CONFIG) {}

  /** Filter one sample stamped at `tMs`. Returns the smoothed value. */
  filter(x: number, tMs: number): number {
    if (this.lastTimeMs == null) {
      // True first sample: seed history, pass through.
      this.lastTimeMs = tMs;
      this.lastRawX = x;
      this.xFilter.filter(x, 1);
      return x;
    }
    if (tMs <= this.lastTimeMs) {
      // Non-advancing clock (duplicate/backward timestamp): dt is undefined. HOLD the
      // current smoothed estimate — do NOT clobber state with the raw sample (that
      // would inject a spike into the next output) and do NOT regress lastTimeMs.
      return this.xFilter.lastValue ?? x;
    }

    const dtSec = (tMs - this.lastTimeMs) / 1000;
    const dx = (x - (this.lastRawX as number)) / dtSec; // deg/s
    const edx = this.dxFilter.filter(dx, smoothingFactor(dtSec, this.cfg.dCutoff));
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(edx);
    const hatX = this.xFilter.filter(x, smoothingFactor(dtSec, cutoff));

    this.lastTimeMs = tMs;
    this.lastRawX = x;
    return hatX;
  }

  /** Clear all history (call at drill start / after a pause re-anchor). */
  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTimeMs = null;
    this.lastRawX = null;
  }
}
