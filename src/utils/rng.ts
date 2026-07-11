/** Mulberry32 — deterministic [0,1) when seed is provided. */
import {
  mulberry32,
  pick,
  randomInt,
  systemRng,
  type Rng,
} from './random';

/** Prefer {@link mulberry32} / {@link systemRng}; kept for existing call sites. */
export function createRng(seed?: number): Rng {
  return seed == null ? systemRng : mulberry32(seed);
}

export { pick, randomInt };
export type { Rng };
