import { createDefaultDrillConfig } from '@/constants';
import {
  DEFAULT_AUDIO_OPTIONS,
  type AudioCueEngineOptions,
} from '@/services/audio/types';
import type { DrillConfig } from '@/types';

import type { AppSettings } from './types';

export const SETTINGS_KEY = 'app.settings';

export function createDefaultAppSettings(): AppSettings {
  return {
    version: 1,
    audio: { ...DEFAULT_AUDIO_OPTIONS },
    drill: createDefaultDrillConfig(),
    keepAwakeDefault: true,
    brightnessBoost: false,
    turnReactLandscape: false,
  };
}

export function serializeAppSettings(settings: AppSettings): string {
  return JSON.stringify(settings);
}

export function parseAppSettings(json: string | null | undefined): AppSettings {
  const defaults = createDefaultAppSettings();
  if (!json) return defaults;
  try {
    const raw = JSON.parse(json) as Partial<AppSettings>;
    return {
      version: 1,
      audio: {
        ...defaults.audio,
        ...(raw.audio ?? {}),
      } satisfies AudioCueEngineOptions,
      drill: createDefaultDrillConfig(
        (raw.drill ?? {}) as Partial<DrillConfig> & Record<string, unknown>,
      ),
      keepAwakeDefault:
        typeof raw.keepAwakeDefault === 'boolean'
          ? raw.keepAwakeDefault
          : defaults.keepAwakeDefault,
      brightnessBoost:
        typeof raw.brightnessBoost === 'boolean'
          ? raw.brightnessBoost
          : defaults.brightnessBoost,
      turnReactLandscape:
        typeof raw.turnReactLandscape === 'boolean'
          ? raw.turnReactLandscape
          : defaults.turnReactLandscape,
    };
  } catch {
    return defaults;
  }
}
