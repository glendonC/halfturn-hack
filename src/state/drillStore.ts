import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { create } from 'zustand';

import { summarizeCueDistribution } from '@/components/drill/sessionStats';
import { createDefaultDrillConfig, getCueDefinition } from '@/constants';
import { isVariableCue } from '@/constants';
import {
  createInitialSchedulerSnapshot,
  fireCueAt,
  getDrillModeBehavior,
  remainingDrillMs,
  shouldFireCue,
  type DrillModeBehavior,
  type SchedulerSnapshot,
} from '@/services/drill';
import { nextIntervalMs } from '@/services/drill/CueScheduler';
import { releaseBeep, TtsCueEngine } from '@/services/audio';
import { saveSession, DRILL_SESSION_SCHEMA_VERSION } from '@/services/db';
import {
  createPoseVerifier,
  computeScanVerification,
  getPoseVerifierAsync,
  type PoseVerifier,
} from '@/services/vision';
import type {
  CueDefinition,
  CueEvent,
  CueType,
  DrillConfig,
  DrillMs,
  ScanVerification,
  WallMs,
} from '@/types';
import { createId, createRng, PausableDrillClocks } from '@/utils';

import { useSettingsStore } from './useSettingsStore';

export type DrillStatus =
  | 'idle'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'paused'
  | 'finished';

export type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';

const KEEP_AWAKE_TAG = 'halfturn-drill';

let audioEngine: TtsCueEngine = new TtsCueEngine();
let poseVerifier: PoseVerifier = createPoseVerifier();
let modeBehavior: DrillModeBehavior = getDrillModeBehavior('audio');
let clocks = new PausableDrillClocks();
let rng: () => number = Math.random;
let scheduler: SchedulerSnapshot | null = null;
let countdownEndsAtWallMs: WallMs | null = null;
let lastSpokenCountdownSec: number | null = null;
/** Test seam — swap TTS / clocks without touching UI. */
export function __setDrillAudioEngineForTests(engine: TtsCueEngine): void {
  audioEngine = engine;
}

export function getDrillAudioEngine(): TtsCueEngine {
  return audioEngine;
}

export function getDrillPoseVerifier(): PoseVerifier {
  return poseVerifier;
}

export interface DrillStoreState {
  status: DrillStatus;
  config: DrillConfig;
  currentCue: CueDefinition | null;
  /** Resolved phrase for the current cue (color/number value or fixed spokenLabel). */
  currentPhrase: string | null;
  lastCueType: CueType | null;
  timeRemainingMs: number;
  countdownRemainingSec: number;
  cuesFired: number;
  cueEvents: CueEvent[];
  sessionId: string | null;
  startedAtWallMs: WallMs | null;
  endedAtWallMs: WallMs | null;
  durationDrillMs: DrillMs;
  persistStatus: PersistStatus;
  persistError: string | null;
  /** Session-level scan verification from the last finished run (null on audio). */
  lastVerification: ScanVerification | null;

  setConfig: (patch: Partial<DrillConfig>) => void;
  enterReady: () => void;
  startCountdown: () => void;
  beginRunning: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  tick: (wallNow?: WallMs) => void;
  testSound: () => Promise<void>;
}

function baseState(config: DrillConfig = createDefaultDrillConfig()) {
  return {
    status: 'idle' as DrillStatus,
    config,
    currentCue: null,
    currentPhrase: null,
    lastCueType: null,
    timeRemainingMs: config.durationMs,
    countdownRemainingSec: config.countdownSec,
    cuesFired: 0,
    cueEvents: [] as CueEvent[],
    sessionId: null as string | null,
    startedAtWallMs: null as WallMs | null,
    endedAtWallMs: null as WallMs | null,
    durationDrillMs: 0 as DrillMs,
    persistStatus: 'idle' as PersistStatus,
    persistError: null as string | null,
    lastVerification: null as ScanVerification | null,
  };
}

async function setKeepAwake(active: boolean): Promise<void> {
  try {
    if (active) {
      if (!useSettingsStore.getState().settings.keepAwake) return;
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
  } catch {
    // Keep-awake is best-effort (web / unsupported).
  }
}

async function fireHaptic(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics unavailable on some platforms.
  }
}

function finishSession(
  set: (
    partial:
      | Partial<DrillStoreState>
      | ((s: DrillStoreState) => Partial<DrillStoreState>),
  ) => void,
  get: () => DrillStoreState,
  wallNow: WallMs,
  completed: boolean,
): void {
  clocks.pause(wallNow);
  const durationDrillMs = clocks.drillNow(wallNow);
  void setKeepAwake(false);
  void audioEngine.stop();
  releaseBeep();
  const verifier = poseVerifier;
  poseVerifier = createPoseVerifier();
  scheduler = null;
  countdownEndsAtWallMs = null;
  lastSpokenCountdownSec = null;

  set({
    status: 'finished',
    timeRemainingMs: 0,
    durationDrillMs,
    endedAtWallMs: wallNow,
    persistStatus: 'saving',
    persistError: null,
  });

  const snapshot = get();
  void (async () => {
    let verification: ScanVerification | null = null;
    try {
      const scans = await verifier.stop();
      if (verifier.available) {
        verification = computeScanVerification(
          scans,
          snapshot.cueEvents,
          durationDrillMs / 1000,
          verifier.engine ?? 'vision',
          undefined,
          { quality: verifier.quality?.() ?? undefined },
        );
      }
    } catch (err) {
      console.warn('[drill] verification failed', err);
    }
    try {
      await persistFinishedSession(snapshot, completed, verification);
      if (get().sessionId === snapshot.sessionId) {
        set({ persistStatus: 'saved', persistError: null });
      }
    } catch (err: unknown) {
      if (get().sessionId === snapshot.sessionId) {
        set({
          persistStatus: 'error',
          persistError: err instanceof Error ? err.message : 'Save failed',
        });
      }
    }
  })();
}

async function persistFinishedSession(
  state: DrillStoreState,
  completed: boolean,
  verification: ScanVerification | null,
): Promise<void> {
  if (!state.sessionId || state.startedAtWallMs == null) return;
  await saveSession({
    id: state.sessionId,
    startedAtWallMs: state.startedAtWallMs,
    endedAtWallMs: state.endedAtWallMs ?? Date.now(),
    durationDrillMs: state.durationDrillMs,
    mode: state.config.mode,
    config: state.config,
    cues: state.cueEvents,
    distribution: summarizeCueDistribution(state.cueEvents),
    completed,
    schemaVersion: DRILL_SESSION_SCHEMA_VERSION,
    verification,
  });
}

export const useDrillStore = create<DrillStoreState>((set, get) => ({
  ...baseState(),

  setConfig: (patch) => {
    const { status, config } = get();
    if (
      status === 'countdown' ||
      status === 'running' ||
      status === 'paused'
    ) {
      return;
    }
    const next = { ...config, ...patch };
    if (patch.intervalMs) {
      next.intervalMs = { ...config.intervalMs, ...patch.intervalMs };
    }
    if (patch.enabledCues) {
      next.enabledCues = [...patch.enabledCues];
    }
    set({
      config: next,
      timeRemainingMs: next.durationMs,
      countdownRemainingSec: next.countdownSec,
    });
  },

  enterReady: () => {
    const { status, config } = get();
    if (status !== 'idle' && status !== 'finished') return;
    set({
      ...baseState(config),
      status: 'ready',
      timeRemainingMs: config.durationMs,
      countdownRemainingSec: config.countdownSec,
    });
  },

  startCountdown: () => {
    const { status, config } = get();
    if (status !== 'ready' && status !== 'idle') return;
    const wallNow = Date.now();
    countdownEndsAtWallMs = wallNow + Math.max(0, config.countdownSec) * 1000;
    lastSpokenCountdownSec = null;
    void setKeepAwake(true);
    void audioEngine.prepare(useSettingsStore.getState().settings);
    set({
      status: 'countdown',
      countdownRemainingSec: config.countdownSec,
      currentCue: null,
      currentPhrase: null,
      lastCueType: null,
      cuesFired: 0,
      cueEvents: [],
      sessionId: createId('session'),
      startedAtWallMs: null,
      endedAtWallMs: null,
      durationDrillMs: 0,
      timeRemainingMs: config.durationMs,
    });
    if (config.countdownSec <= 0) {
      get().beginRunning();
      return;
    }
    if (config.spokenCountdown) {
      lastSpokenCountdownSec = config.countdownSec;
      void audioEngine.speak(String(config.countdownSec));
    }
  },

  beginRunning: () => {
    const { status, config, sessionId } = get();
    if (status !== 'countdown' && status !== 'ready') return;

    const wallNow = Date.now();
    rng = createRng(config.seed);
    clocks = new PausableDrillClocks();
    clocks.start(wallNow);
    scheduler = createInitialSchedulerSnapshot(config, rng);
    countdownEndsAtWallMs = null;

    modeBehavior = getDrillModeBehavior(config.mode);
    poseVerifier = modeBehavior.resolveVerifier();
    poseVerifier.start(0);
    if (config.mode === 'turn_react') {
      void getPoseVerifierAsync().then((v) => {
        // Ignore stale resolves if the run already ended.
        if (get().status !== 'running' && get().status !== 'paused') return;
        void poseVerifier.stop().catch(() => {});
        poseVerifier = v;
        poseVerifier.start(0);
      });
    }

    void setKeepAwake(true);
    void audioEngine.prepare(useSettingsStore.getState().settings);
    modeBehavior.prepareAudio(audioEngine);

    set({
      status: 'running',
      sessionId: sessionId ?? createId('session'),
      startedAtWallMs: wallNow,
      endedAtWallMs: null,
      countdownRemainingSec: 0,
      timeRemainingMs: config.durationMs,
      durationDrillMs: 0,
      currentCue: null,
      currentPhrase: null,
      cuesFired: 0,
      cueEvents: [],
      lastCueType: null,
    });
  },

  pause: () => {
    const { status, config } = get();
    if (status !== 'running') return;
    const wallNow = Date.now();
    clocks.pause(wallNow);
    void setKeepAwake(false);
    void audioEngine.stop();
    poseVerifier.pause?.();
    set({
      status: 'paused',
      durationDrillMs: clocks.drillNow(wallNow),
      timeRemainingMs: remainingDrillMs(config.durationMs, clocks.drillNow(wallNow)),
    });
  },

  resume: () => {
    const { status, config } = get();
    if (status !== 'paused') return;
    const wallNow = Date.now();
    clocks.resume(wallNow);
    void setKeepAwake(true);
    poseVerifier.resume?.();
    set({
      status: 'running',
      durationDrillMs: clocks.drillNow(wallNow),
      timeRemainingMs: remainingDrillMs(config.durationMs, clocks.drillNow(wallNow)),
    });
  },

  stop: () => {
    const { status } = get();
    if (
      status !== 'countdown' &&
      status !== 'running' &&
      status !== 'paused'
    ) {
      return;
    }
    finishSession(set, get, Date.now(), false);
  },

  reset: () => {
    void setKeepAwake(false);
    void audioEngine.stop();
    void poseVerifier.stop().catch(() => {});
    poseVerifier = createPoseVerifier();
    scheduler = null;
    countdownEndsAtWallMs = null;
    lastSpokenCountdownSec = null;
    clocks = new PausableDrillClocks();
    set(baseState(get().config));
  },

  tick: (wallNowArg) => {
    const wallNow = wallNowArg ?? Date.now();
    const state = get();

    if (state.status === 'countdown') {
      if (countdownEndsAtWallMs == null) return;
      const remainingMs = Math.max(0, countdownEndsAtWallMs - wallNow);
      const remainingSec = Math.ceil(remainingMs / 1000);
      if (remainingMs <= 0) {
        set({ countdownRemainingSec: 0 });
        get().beginRunning();
        return;
      }
      if (remainingSec !== state.countdownRemainingSec) {
        set({ countdownRemainingSec: remainingSec });
        if (
          state.config.spokenCountdown &&
          remainingSec > 0 &&
          remainingSec !== lastSpokenCountdownSec
        ) {
          lastSpokenCountdownSec = remainingSec;
          void audioEngine.speak(String(remainingSec));
        }
      }
      return;
    }

    if (state.status !== 'running' || scheduler == null) return;

    const drillNow = clocks.drillNow(wallNow);
    const timeRemainingMs = remainingDrillMs(state.config.durationMs, drillNow);

    if (drillNow >= state.config.durationMs) {
      set({ timeRemainingMs: 0, durationDrillMs: drillNow });
      finishSession(set, get, wallNow, true);
      return;
    }

    let nextScheduler = scheduler;
    let currentCue = state.currentCue;
    let currentPhrase = state.currentPhrase;
    let lastCueType = state.lastCueType;
    let cueEvents = state.cueEvents;
    let cuesFired = state.cuesFired;

    // Catch up if tick lagged (fire at most a few cues per tick).
    let guard = 0;
    while (
      shouldFireCue(nextScheduler, drillNow, state.config.durationMs) &&
      guard < 3
    ) {
      guard += 1;
      const fired = fireCueAt({
        config: state.config,
        snapshot: nextScheduler,
        onsetDrillMs: nextScheduler.nextCueAtDrillMs,
        onsetWallMs: wallNow,
        random: rng,
        id: createId('cue'),
      });
      const resolved = modeBehavior.resolveCue(
        fired.picked,
        rng,
        state.config,
        fired.priorState,
      );
      const phrase = resolved.phrase;
      const floor = modeBehavior.minIntervalFloorMs(phrase, audioEngine);
      const gap = nextIntervalMs(rng, state.config, floor);
      nextScheduler = {
        pickState: resolved.nextState,
        nextCueAtDrillMs: fired.event.onsetDrillMs + gap,
        cuesFired: fired.snapshot.cuesFired,
      };
      const event: CueEvent = {
        ...fired.event,
        phrase,
        verification: null,
      };

      currentCue = fired.cue;
      currentPhrase = phrase;
      lastCueType = fired.cue.type;
      cueEvents = [...cueEvents, event];
      cuesFired = nextScheduler.cuesFired;

      modeBehavior.presentCue(phrase, audioEngine);
      void fireHaptic(state.config.haptics);
    }

    scheduler = nextScheduler;
    set({
      timeRemainingMs,
      durationDrillMs: drillNow,
      currentCue,
      currentPhrase,
      lastCueType,
      cueEvents,
      cuesFired,
    });
  },

  testSound: async () => {
    await audioEngine.prepare(useSettingsStore.getState().settings);
    await audioEngine.testSound();
  },
}));

/** Selectors for thin hooks / UI */
export function selectDrillStatus(s: DrillStoreState): DrillStatus {
  return s.status;
}

export function selectCurrentCueLabel(s: DrillStoreState): string | null {
  if (s.status === 'countdown' && s.countdownRemainingSec > 0) {
    return String(s.countdownRemainingSec);
  }
  if (s.currentCue && isVariableCue(s.currentCue.id) && s.currentPhrase) {
    return s.currentPhrase;
  }
  return s.currentCue?.hudLabel ?? s.currentCue?.spokenLabel ?? null;
}

export function formatRemainingClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Re-export for convenience in tests / setup screens later
export { getCueDefinition };
