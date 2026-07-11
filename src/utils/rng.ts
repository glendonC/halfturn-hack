/** Mulberry32 — deterministic [0,1) when seed is provided. */
export function createRng(seed?: number): () => number {
  if (seed == null) {
    return Math.random;
  }

  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
export function randomInt(
  random: () => number,
  min: number,
  max: number,
): number {
  let lo = min;
  let hi = max;
  if (hi < lo) [lo, hi] = [hi, lo];
  return Math.floor(random() * (hi - lo + 1)) + lo;
}

/** Uniform pick from a non-empty array. */
export function pick<T>(random: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick() called on an empty array');
  return arr[Math.floor(random() * arr.length)]!;
}
