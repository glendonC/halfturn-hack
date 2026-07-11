import { create } from 'zustand';

import {
  clearAllSessions,
  createDefaultAppSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
} from '@/services/db';
import type { AudioCueEngineOptions } from '@/services/audio';
import type { CueType, DrillConfig } from '@/types';

import { getDrillAudioEngine, useDrillStore } from './drillStore';

export interface SettingsStoreState {
  hydrated: boolean;
  settings: AppSettings;
  hydrate: () => Promise<void>;
  patchAudio: (patch: Partial<AudioCueEngineOptions>) => Promise<void>;
  patchDrillDefaults: (patch: Partial<DrillConfig>) => Promise<void>;
  setKeepAwakeDefault: (value: boolean) => Promise<void>;
  toggleDefaultCue: (cue: CueType) => Promise<void>;
  clearHistory: () => Promise<void>;
}

async function persistAndApply(next: AppSettings): Promise<void> {
  await saveSettings(next);
  useDrillStore.getState().hydrateFromSettings(next);
  getDrillAudioEngine().setOptions(next.audio);
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  hydrated: false,
  settings: createDefaultAppSettings(),

  hydrate: async () => {
    const settings = await loadSettings();
    useDrillStore.getState().hydrateFromSettings(settings);
    getDrillAudioEngine().setOptions(settings.audio);
    set({ settings, hydrated: true });
  },

  patchAudio: async (patch) => {
    const next: AppSettings = {
      ...get().settings,
      audio: { ...get().settings.audio, ...patch },
    };
    set({ settings: next });
    await persistAndApply(next);
  },

  patchDrillDefaults: async (patch) => {
    const current = get().settings;
    const drill = {
      ...current.drill,
      ...patch,
      intervalMs: patch.intervalMs
        ? { ...current.drill.intervalMs, ...patch.intervalMs }
        : current.drill.intervalMs,
      enabledCues: patch.enabledCues
        ? [...patch.enabledCues]
        : current.drill.enabledCues,
    };
    const next: AppSettings = { ...current, drill };
    set({ settings: next });
    await persistAndApply(next);
  },

  setKeepAwakeDefault: async (value) => {
    const next: AppSettings = {
      ...get().settings,
      keepAwakeDefault: value,
    };
    set({ settings: next });
    await persistAndApply(next);
  },

  toggleDefaultCue: async (cue) => {
    const enabled = new Set(get().settings.drill.enabledCues);
    if (enabled.has(cue)) {
      if (enabled.size <= 1) return;
      enabled.delete(cue);
    } else {
      enabled.add(cue);
    }
    await get().patchDrillDefaults({ enabledCues: [...enabled] });
  },

  clearHistory: async () => {
    await clearAllSessions();
  },
}));
