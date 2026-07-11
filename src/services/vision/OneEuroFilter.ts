/**
 * One-Euro filter (Casiez, Roussel & Vogel, CHI 2012) — speed-adaptive low-pass
 * for noisy yaw. Pure + dependency-free (timestamps passed in). Not wired into
 * the live path yet; library code for a future backend feed.
 */

/** One-pole exponential low-pass with an externally supplied smoothing factor. */
class LowPass {
  private hatXPrev: number | null = null;
  private initialized = false;

  filter(x: number, alpha: number): number {
    const hatX = this.initialized
      ? alpha * x + (1 - alpha) * (this.hatXPrev as number)
      : x;
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
  /** Minimum cutoff (Hz) when the signal is slow/still. */
  minCutoff: number;
  /** Speed coefficient — higher = less lag during fast motion. */
  beta: number;
  /** Cutoff (Hz) for the derivative's own low-pass. */
  dCutoff: number;
}

export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1.0,
  beta: 0.015,
  dCutoff: 1.0,
};

function smoothingFactor(dtSec: number, fcHz: number): number {
  const tau = 1 / (2 * Math.PI * fcHz);
  return 1 / (1 + tau / dtSec);
}

export class OneEuroFilter {
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private lastTimeMs: number | null = null;
  private lastRawX: number | null = null;

  constructor(private readonly cfg: OneEuroConfig = DEFAULT_ONE_EURO_CONFIG) {}

  filter(x: number, tMs: number): number {
    if (this.lastTimeMs == null) {
      this.lastTimeMs = tMs;
      this.lastRawX = x;
      this.xFilter.filter(x, 1);
      return x;
    }
    if (tMs <= this.lastTimeMs) {
      return this.xFilter.lastValue ?? x;
    }

    const dtSec = (tMs - this.lastTimeMs) / 1000;
    const dx = (x - (this.lastRawX as number)) / dtSec;
    const edx = this.dxFilter.filter(
      dx,
      smoothingFactor(dtSec, this.cfg.dCutoff),
    );
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(edx);
    const hatX = this.xFilter.filter(x, smoothingFactor(dtSec, cutoff));

    this.lastTimeMs = tMs;
    this.lastRawX = x;
    return hatX;
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTimeMs = null;
    this.lastRawX = null;
  }
}
