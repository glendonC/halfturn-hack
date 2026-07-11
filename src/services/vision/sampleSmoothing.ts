/**
 * One-Euro smoothing of a PoseSample yaw stream. Pure + deterministic.
 * Off by default in live drills — changes which scans are detected when wired.
 */

import { OneEuroFilter, type OneEuroConfig } from './OneEuroFilter';
import type { PoseSample } from './types';

export function smoothPoseSamples(
  samples: PoseSample[],
  cfg: OneEuroConfig,
): PoseSample[] {
  const filter = new OneEuroFilter(cfg);
  return samples.map((s) => ({
    ...s,
    yawDeg: filter.filter(s.yawDeg, s.tMonoMs),
  }));
}
