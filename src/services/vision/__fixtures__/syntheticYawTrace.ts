/**
 * Synthetic golden yaw trace — authored PoseSamples only (no landmarks / athlete data).
 * Neutral → LEFT half-turn → sub-threshold bob → RIGHT half-turn at ~15fps.
 */

import type { CueEvent } from '@/types';

import type { PoseSample, ScanDetectConfig } from '../types';

const FRAME_SPACING_MS = 66;
const CONF = 0.9;

/**
 * Player-frame torso yaw per frame (deg; <0 = left).
 * 0–4 neutral; 5–10 LEFT; 11–16 bob (rejected); 17–22 RIGHT; 23–25 neutral.
 */
const YAW_SCRIPT: number[] = [
  0, 0, 0, 0, 0, -15, -30, -45, -45, -25, -10, 0, -10, 8, -6, 0, 0, 18, 33, 45,
  40, 20, 12, 0, 0, 0,
];

export const SYNTHETIC_SAMPLES: PoseSample[] = YAW_SCRIPT.map((yawDeg, idx) => ({
  tMonoMs: idx * FRAME_SPACING_MS,
  yawDeg,
  confidence: CONF,
}));

/** Detector config pinned in-fixture so a retune is a visible diff. */
export const SYNTHETIC_CONFIG: ScanDetectConfig = {
  yawEnterDeg: 28,
  yawExitDeg: 15,
  minHoldMs: 150,
  minConfidence: 0.5,
  refractoryMs: 400,
  scanBeforeWindowMs: 2500,
};

/**
 * Action cues on the drill axis:
 * - @350ms before left peak (462) → reaction
 * - @1400ms after right peak (1254) → scanned-before
 */
export const SYNTHETIC_CUES: CueEvent[] = [
  {
    seq: 0,
    cueId: 'turn',
    category: 'action',
    phrase: 'Turn',
    side: 'none',
    firedAtEpochMs: 0,
    firedAtMonoMs: 350,
    plannedOffsetMs: 350,
  },
  {
    seq: 1,
    cueId: 'turn',
    category: 'action',
    phrase: 'Turn',
    side: 'none',
    firedAtEpochMs: 0,
    firedAtMonoMs: 1400,
    plannedOffsetMs: 1400,
  },
];
