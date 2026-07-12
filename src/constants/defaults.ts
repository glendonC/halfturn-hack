import type { DrillConfig, Settings } from '@/types';
import { ALL_CUE_IDS } from './cues';

/** Slider/control bounds, shared by setup + settings screens. */
export const DURATION_BOUNDS = { min: 60, max: 1800, step: 30 } as const; // 1–30 min
export const INTERVAL_BOUNDS = { min: 1, max: 12, step: 0.5 } as const; // seconds
export const VOLUME_BOUNDS = { min: 0, max: 1, step: 0.05 } as const;
export const RATE_BOUNDS = { min: 0.5, max: 1.5, step: 0.05 } as const;
export const PITCH_BOUNDS = { min: 0.7, max: 1.6, step: 0.05 } as const;

/** Quick-pick drill lengths (seconds): 3 / 5 / 10 / 15 min. */
export const DURATION_PRESETS = [180, 300, 600, 900] as const;

/** Minimum interval span so min/max sliders never invert. */
export const MIN_INTERVAL_SPAN = 0.5;

export const DEFAULT_DRILL_CONFIG: DrillConfig = {
  durationSec: 300,
  intervalMinSec: 3,
  intervalMaxSec: 6,
  enabledCues: ['check_left', 'check_right', 'man_on', 'turn', 'scan', 'open_body'],
  leftRightBalance: 0.5,
  avoidImmediateRepeat: true,
  countdownEnabled: true,
  mode: 'audio',
};

export const DEFAULT_SETTINGS: Settings = {
  cueVolume: 1.0,
  speechRate: 1.0,
  speechPitch: 1.0,
  voiceId: null,
  language: 'en-US',
  enabledVocabulary: [...ALL_CUE_IDS],
  audioOutputMode: 'headphones',
  audioSource: 'tts',
  hapticsEnabled: true,
  keepAwake: true,
  brightnessBoost: false,
  turnReactLandscape: false,
};
