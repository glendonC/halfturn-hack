import { create } from 'zustand';

import { CUE_ORDER } from '@/constants/cues';
import { createDefaultDrillConfig } from '@/constants/defaults';
import type { CueType, DrillConfig } from '@/types';

import { useDrillStore } from './drillStore';

const MIN_INTERVAL_SPAN_MS = 500;

interface DrillConfigStore {
  /** Live setup config (mirrors drillStore.config). */
  config: DrillConfig;
  setConfig: (patch: Partial<DrillConfig>) => void;
  /** Toggle a cue type for the next drill (keeps catalog order). */
  toggleCue: (id: CueType) => void;
  /** Set interval bounds while keeping min <= max with a minimum span. */
  setInterval: (minMs: number, maxMs: number) => void;
  reset: () => void;
  /** Pull latest config from the drill store (after hydrate). */
  syncFromDrillStore: () => void;
}

/**
 * Production-shaped drill config store.
 * Writes through to useDrillStore so setup UI and the engine stay in sync
 * without a second persistence path yet.
 */
export const useDrillConfigStore = create<DrillConfigStore>((set, get) => ({
  config: createDefaultDrillConfig(),

  setConfig: (patch) => {
    useDrillStore.getState().setConfig(patch);
    set({ config: useDrillStore.getState().config });
  },

  toggleCue: (id) => {
    const enabled = get().config.enabledCues;
    const has = enabled.includes(id);
    const next = has ? enabled.filter((x) => x !== id) : [...enabled, id];
    if (next.length === 0) return;
    const enabledCues = CUE_ORDER.filter((c) => next.includes(c));
    get().setConfig({ enabledCues });
  },

  setInterval: (minMs, maxMs) => {
    const lo = Math.min(minMs, maxMs);
    const hi = Math.max(minMs, maxMs, lo + MIN_INTERVAL_SPAN_MS);
    get().setConfig({ intervalMs: { min: lo, max: hi } });
  },

  reset: () => {
    const config = createDefaultDrillConfig();
    useDrillStore.getState().setConfig(config);
    set({ config });
  },

  syncFromDrillStore: () => {
    set({ config: useDrillStore.getState().config });
  },
}));
