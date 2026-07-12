import { create } from 'zustand';

import type { CueCounts, CueEvent, DrillConfig, DrillSession, DrillStatus } from '@/types';

/** A live camera-verified turn, matched to the cue it answered (UX pulse only). */
export interface ScanConfirm {
  /** Monotonic id so UI effects re-fire on every confirm. */
  id: number;
  cueSeq: number;
  direction: 'left' | 'right';
}

/** Deep-ish clone so the run snapshot can't be mutated by the persisted store. */
function cloneConfig(config: DrillConfig): DrillConfig {
  return { ...config, enabledCues: [...config.enabledCues] };
}

interface DrillRuntimeStore {
  status: DrillStatus;
  /** Frozen snapshot of the config this run executes (never the live store). */
  runConfig: DrillConfig | null;
  /** Wall-clock epoch ms at the moment the running phase began. */
  startedAtEpoch: number | null;
  /** Drill-clock ms elapsed, excluding paused time. */
  elapsedMs: number;
  /** Drill-clock ms remaining. */
  remainingMs: number;
  /** Most recent fired cue — drives the HUD flood/flash (keyed on `seq`). */
  currentCue: CueEvent | null;
  /** Most recent live-verified turn (turn-react with a real camera; else null). */
  scanConfirm: ScanConfirm | null;
  cueCounts: CueCounts;
  events: CueEvent[];
  /** The finished session, handed to the Summary screen (in-memory). */
  result: DrillSession | null;

  /** Snapshot the config and reset all runtime counters for a fresh run. */
  initRun: (config: DrillConfig) => void;
  setStatus: (status: DrillStatus) => void;
  markStarted: (startedAtEpoch: number) => void;
  setClock: (elapsedMs: number, remainingMs: number) => void;
  recordCue: (event: CueEvent) => void;
  recordScanConfirm: (cueSeq: number, direction: 'left' | 'right') => void;
  setResult: (result: DrillSession) => void;
  reset: () => void;
}

const IDLE = {
  status: 'idle' as DrillStatus,
  runConfig: null,
  startedAtEpoch: null,
  elapsedMs: 0,
  remainingMs: 0,
  currentCue: null,
  scanConfirm: null as ScanConfirm | null,
  cueCounts: {} as CueCounts,
  events: [] as CueEvent[],
  result: null as DrillSession | null,
};

let scanConfirmId = 0;

export const useDrillStore = create<DrillRuntimeStore>((set) => ({
  ...IDLE,

  initRun: (config) =>
    set({
      ...IDLE,
      runConfig: cloneConfig(config),
      status: 'countdown',
      remainingMs: config.durationSec * 1000,
    }),

  setStatus: (status) => set({ status }),

  markStarted: (startedAtEpoch) => set({ startedAtEpoch }),

  setClock: (elapsedMs, remainingMs) => set({ elapsedMs, remainingMs }),

  recordCue: (event) =>
    set((s) => ({
      currentCue: event,
      events: [...s.events, event],
      cueCounts: { ...s.cueCounts, [event.cueId]: (s.cueCounts[event.cueId] ?? 0) + 1 },
    })),

  recordScanConfirm: (cueSeq, direction) =>
    set({ scanConfirm: { id: ++scanConfirmId, cueSeq, direction } }),

  setResult: (result) => set({ result }),

  reset: () => set({ ...IDLE }),
}));
