/**
 * Tiny seedable RNG so the cue scheduler is pure and unit-testable.
 * In the app we use `systemRng` (Math.random); tests/replays can pass a seeded
 * `mulberry32` to get deterministic cue sequences.
 */

export type Rng = () => number; // returns a float in [0, 1)

/** Deterministic, fast PRNG. Good enough for drill randomization. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const systemRng: Rng = () => Math.random();

/** Inclusive integer in [min, max]. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick() called on an empty array');
  return arr[Math.floor(rng() * arr.length)]!;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** Weighted random selection. Non-positive total weight falls back to uniform. */
export function weightedPick<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  if (items.length === 0) throw new Error('weightedPick() called on an empty array');
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  if (total <= 0) return pick(rng, items).value;
  let r = rng() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

/** True with probability p (clamped to [0, 1]). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < Math.min(1, Math.max(0, p));
}
