import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { CUE_ORDER } from '@/constants/cues';
import { DEFAULT_DRILL_CONFIG, MIN_INTERVAL_SPAN } from '@/constants/defaults';
import type { CueId, DrillConfig } from '@/types';
import { zustandStorage } from './storage';

interface DrillConfigStore {
  config: DrillConfig;
  setConfig: (patch: Partial<DrillConfig>) => void;
  /** Toggle a cue type for the next drill (keeps catalog order). */
  toggleCue: (id: CueId) => void;
  /** Set interval bounds while keeping min <= max with a minimum span. */
  setInterval: (minSec: number, maxSec: number) => void;
  reset: () => void;
}

export const useDrillConfigStore = create<DrillConfigStore>()(
  persist(
    (set) => ({
      config: DEFAULT_DRILL_CONFIG,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      toggleCue: (id) =>
        set((s) => {
          const has = s.config.enabledCues.includes(id);
          const next = has
            ? s.config.enabledCues.filter((x) => x !== id)
            : [...s.config.enabledCues, id];
          // Keep at least one cue enabled.
          if (next.length === 0) return s;
          return {
            config: { ...s.config, enabledCues: CUE_ORDER.filter((c) => next.includes(c)) },
          };
        }),
      setInterval: (minSec, maxSec) =>
        set((s) => {
          const lo = Math.min(minSec, maxSec);
          const hi = Math.max(minSec, maxSec, lo + MIN_INTERVAL_SPAN);
          return { config: { ...s.config, intervalMinSec: lo, intervalMaxSec: hi } };
        }),
      reset: () => set({ config: DEFAULT_DRILL_CONFIG }),
    }),
    {
      name: 'halfturn-drill-config',
      version: 1,
      storage: zustandStorage,
      partialize: (s) => ({ config: s.config }),
      migrate: (persisted) => {
        const p = persisted as { config?: Partial<DrillConfig> } | undefined;
        return { config: { ...DEFAULT_DRILL_CONFIG, ...(p?.config ?? {}) } };
      },
    },
  ),
);
