import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { CUE_ORDER } from '@/constants/cues';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import type { CueId, Settings } from '@/types';
import { zustandStorage } from './storage';

interface SettingsStore {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Toggle a cue in the app-wide vocabulary (keeps catalog order). */
  toggleVocabulary: (id: CueId) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      toggleVocabulary: (id) =>
        set((s) => {
          const has = s.settings.enabledVocabulary.includes(id);
          const next = has
            ? s.settings.enabledVocabulary.filter((x) => x !== id)
            : [...s.settings.enabledVocabulary, id];
          // Never allow an empty vocabulary.
          if (next.length === 0) return s;
          return {
            settings: {
              ...s.settings,
              enabledVocabulary: CUE_ORDER.filter((c) => next.includes(c)),
            },
          };
        }),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'halfturn-settings',
      version: 1,
      storage: zustandStorage,
      partialize: (s) => ({ settings: s.settings }),
      // Forward-compatible: fill any newly-added Settings fields with defaults.
      migrate: (persisted) => {
        const p = persisted as { settings?: Partial<Settings> } | undefined;
        return { settings: { ...DEFAULT_SETTINGS, ...(p?.settings ?? {}) } };
      },
    },
  ),
);

/** Convenience hook returning just the settings object. */
export const useSettings = (): Settings => useSettingsStore((s) => s.settings);
