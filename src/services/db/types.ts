import type { AudioCueEngineOptions } from '@/services/audio';
import type { DrillConfig } from '@/types';

/** Persisted app settings (single JSON blob in settings_kv). */
export interface AppSettings {
  version: 1;
  audio: AudioCueEngineOptions;
  /** Defaults applied to new drills / Train setup */
  drill: DrillConfig;
  /** When false, skip activateKeepAwake during countdown/running */
  keepAwakeDefault: boolean;
  /** Max screen brightness while a drill runs (outdoor). Off by default. */
  brightnessBoost: boolean;
  /** Landscape lock during Turn & React. Off by default. */
  turnReactLandscape: boolean;
}
