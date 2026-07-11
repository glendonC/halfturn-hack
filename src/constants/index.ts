export {
  ALL_CUE_IDS,
  ALL_CUE_IDS as ALL_CUE_TYPES,
  COLOR_WORDS,
  CUE_ORDER,
  CUES,
  getCue,
  getCue as getCueDefinition,
  listCues,
  NUMBER_RANGE,
  resolveCuePhrase,
} from './cues';
export {
  clampLeftRightBalance,
  createDefaultDrillConfig,
  DEFAULT_DRILL_CONFIG,
  DEFAULT_LEFT_RIGHT_BALANCE,
  DEFAULT_REACTION_WINDOW_MS,
  DEFAULT_SETTINGS,
  DURATION_BOUNDS,
  DURATION_PRESETS,
  filterEnabledCues,
  INTERVAL_BOUNDS,
  leftShare,
  MIN_INTERVAL_SPAN,
  PITCH_BOUNDS,
  RATE_BOUNDS,
  signedBlindSideBalance,
  VOLUME_BOUNDS,
} from './defaults';
export {
  directionalLeftProbability,
  pickDirectionalCheck,
  pickNextCue,
  type PickNextCueArgs,
  type RandomFn,
} from './pickCue';
export { REVEAL_PAD_MS, REVEAL_WINDOW_MS } from './turnReact';
export {
  MIN_TRACKING_CONFIDENCE,
  GOOD_TRACKING_CONFIDENCE,
  isInFrame,
  trackingLevel,
  type TrackingLevel,
} from './visionTuning';

import { CUES } from './cues';
import type { CueId } from '@/types';

/** Default mix excludes variable cues (opt-in via setup). */
export const DEFAULT_ENABLED_CUES: readonly CueId[] = [
  'check_left',
  'check_right',
  'man_on',
  'turn',
  'scan',
  'open_body',
];

export const CUE_BY_ID = CUES;
export const CUE_CATALOG = Object.values(CUES);

export function isDirectionalCheck(type: CueId): boolean {
  return type === 'check_left' || type === 'check_right';
}

export function isVariableCue(type: CueId): boolean {
  return type === 'color' || type === 'number';
}
