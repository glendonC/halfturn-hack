import type { CueId, DrillConfig, Settings } from '@/types';

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

export const DEFAULT_LEFT_RIGHT_BALANCE = 0.5;

/** Reaction window placeholders (Phase 2) — versioned with metrics later */
export const DEFAULT_REACTION_WINDOW_MS = {
  early: 250,
  late: 1_200,
} as const;

/**
 * Merge overrides onto defaults. Also tolerates older persisted shapes that used
 * ms-based duration/interval fields or turn_react mode spelling.
 */
export function createDefaultDrillConfig(
  overrides: Partial<DrillConfig> | (Partial<DrillConfig> & Record<string, unknown>) = {},
): DrillConfig {
  const raw = overrides as Partial<DrillConfig> & Record<string, unknown>;
  const next: DrillConfig = { ...DEFAULT_DRILL_CONFIG };

  if (typeof raw.durationSec === 'number') {
    next.durationSec = raw.durationSec;
  } else if (typeof raw.durationMs === 'number') {
    next.durationSec = Math.round(raw.durationMs / 1000);
  }

  if (typeof raw.intervalMinSec === 'number' && typeof raw.intervalMaxSec === 'number') {
    next.intervalMinSec = raw.intervalMinSec;
    next.intervalMaxSec = raw.intervalMaxSec;
  } else if (
    raw.intervalMs &&
    typeof raw.intervalMs === 'object' &&
    typeof (raw.intervalMs as { min?: number }).min === 'number' &&
    typeof (raw.intervalMs as { max?: number }).max === 'number'
  ) {
    const band = raw.intervalMs as { min: number; max: number };
    next.intervalMinSec = band.min / 1000;
    next.intervalMaxSec = band.max / 1000;
  }

  if (Array.isArray(raw.enabledCues)) {
    next.enabledCues = raw.enabledCues as CueId[];
  }
  if (typeof raw.leftRightBalance === 'number') {
    next.leftRightBalance = raw.leftRightBalance;
  }

  if (typeof raw.avoidImmediateRepeat === 'boolean') {
    next.avoidImmediateRepeat = raw.avoidImmediateRepeat;
  } else if (typeof raw.avoidLastN === 'number') {
    next.avoidImmediateRepeat = raw.avoidLastN > 0;
  }

  if (typeof raw.countdownEnabled === 'boolean') {
    next.countdownEnabled = raw.countdownEnabled;
  } else if (typeof raw.spokenCountdown === 'boolean' || typeof raw.countdownSec === 'number') {
    const spoken = typeof raw.spokenCountdown === 'boolean' ? raw.spokenCountdown : true;
    const sec = typeof raw.countdownSec === 'number' ? raw.countdownSec : 3;
    next.countdownEnabled = spoken && sec > 0;
  }

  if (raw.mode === 'audio' || raw.mode === 'turn-react') {
    next.mode = raw.mode;
  } else if (raw.mode === 'turn_react') {
    next.mode = 'turn-react';
  }

  return next;
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

export function filterEnabledCues(enabled: readonly CueId[]): CueId[] {
  return enabled.filter((id, index) => enabled.indexOf(id) === index);
}
