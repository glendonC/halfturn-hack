/**
 * One-Euro smoothing of a PoseSample yaw stream (docs/scan-tracking-architecture.md §2/§4).
 * Pure: constructs a fresh {@link OneEuroFilter}, folds it over the samples in `tMonoMs`
 * order, and returns NEW samples with smoothed `yawDeg` (all other fields echoed). The
 * detector consumes the same `yawDeg + confidence` scalar contract, so `detectScans` is
 * unchanged — this only alters the VALUES, and only when wired in behind the enrichment flag.
 *
 * ⚠️ This CHANGES which scans are detected (smoothing rounds sharp peaks and shifts the
 * enter/exit crossings by the filter's speed-adaptive lag), so it is off by default and
 * belongs behind an A/B flag until the mincutoff/beta are tuned on real on-device traces.
 * Smoothing spans low-confidence samples too; a confidence-aware occlusion policy is
 * deferred (it needs field data to tune the hold/decay windows).
 */

import { OneEuroFilter, type OneEuroConfig } from './OneEuroFilter';
import type { PoseSample } from './types';

/** Smooth `yawDeg` across the stream with a fresh One-Euro filter. Pure + deterministic. */
export function smoothPoseSamples(samples: PoseSample[], cfg: OneEuroConfig): PoseSample[] {
  const filter = new OneEuroFilter(cfg);
  return samples.map((s) => ({ ...s, yawDeg: filter.filter(s.yawDeg, s.tMonoMs) }));
}
