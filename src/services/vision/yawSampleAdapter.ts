/**
 * Convert hack dual-clock YawSample (radians) into detection PoseSample (degrees).
 */

import type { YawSample } from '@/types';

import type { PoseSample } from './types';

const RAD_TO_DEG = 180 / Math.PI;

export function yawSamplesToPoseSamples(
  samples: readonly YawSample[],
): PoseSample[] {
  return samples.map((s) => ({
    tMonoMs: s.drillMs,
    yawDeg: s.yaw * RAD_TO_DEG,
    confidence: s.confidence,
  }));
}
