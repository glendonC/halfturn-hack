import type { DrillConfig, CueType, Settings } from '@/types';

import { ALL_CUE_TYPES, DEFAULT_ENABLED_CUES } from './cues';

/** Slider/control bounds, shared by setup + settings screens. */
export const VOLUME_BOUNDS = { min: 0, max: 1, step: 0.05 } as const;
export const RATE_BOUNDS = { min: 0.5, max: 1.5, step: 0.05 } as const;
export const PITCH_BOUNDS = { min: 0.7, max: 1.6, step: 0.05 } as const;

/** Duration presets (ms) for setup UI later */
export const DURATION_PRESETS_MS = {
  short: 60_000,
  standard: 180_000,
  long: 300_000,
} as const;

/** Persisted app-wide speech / session defaults. */
export const DEFAULT_SETTINGS: Settings = {
  cueVolume: 1,
  speechRate: 1,
  speechPitch: 1,
  voiceId: null,
  language: 'en-US',
  enabledVocabulary: [...ALL_CUE_TYPES],
  audioOutputMode: 'headphones',
  audioSource: 'tts',
  hapticsEnabled: true,
  keepAwake: true,
  brightnessBoost: false,
  turnReactLandscape: false,
};

export type DurationPreset = keyof typeof DURATION_PRESETS_MS;

/** Default random interval band between cues */
export const DEFAULT_INTERVAL_MS = {
  min: 2_500,
  max: 5_000,
} as const;

/** Reaction window placeholders (Phase 2) — versioned with metrics later */
export const DEFAULT_REACTION_WINDOW_MS = {
  early: 250,
  late: 1_200,
} as const;

export const DEFAULT_LEFT_RIGHT_BALANCE = 0.5;

export const DEFAULT_COUNTDOWN_SEC = 3;

export function createDefaultDrillConfig(
  overrides: Partial<DrillConfig> = {},
): DrillConfig {
  return {
    durationMs: DURATION_PRESETS_MS.standard,
    intervalMs: { ...DEFAULT_INTERVAL_MS },
    enabledCues: [...DEFAULT_ENABLED_CUES],
    leftRightBalance: DEFAULT_LEFT_RIGHT_BALANCE,
    countdownSec: DEFAULT_COUNTDOWN_SEC,
    spokenCountdown: true,
    haptics: true,
    avoidLastN: 1,
    mode: 'audio',
    ...overrides,
  };
}

/** Clamp balance into [0, 1]. */
export function clampLeftRightBalance(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_LEFT_RIGHT_BALANCE;
  return Math.min(1, Math.max(0, value));
}

/**
 * Signed blind-side balance from verified (or attempted) L/R counts.
 * (L − R) / (L + R); null when no directional checks yet.
 */
export function signedBlindSideBalance(
  leftCount: number,
  rightCount: number,
): number | null {
  const total = leftCount + rightCount;
  if (total <= 0) return null;
  return (leftCount - rightCount) / total;
}

/** How far current L/R mix is from a target left share (0–1). */
export function leftShare(leftCount: number, rightCount: number): number | null {
  const total = leftCount + rightCount;
  if (total <= 0) return null;
  return leftCount / total;
}

export function filterEnabledCues(enabled: readonly CueType[]): CueType[] {
  return enabled.filter((id, index) => enabled.indexOf(id) === index);
}
