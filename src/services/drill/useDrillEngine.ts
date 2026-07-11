import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getCueDefinition } from '@/constants';
import {
  releaseBeep,
  type AudioCueEngine,
} from '@/services/audio';
import {
  computeScanVerification,
  getPoseVerifierAsync,
  type PoseVerifier,
} from '@/services/vision';
import {
  formatRemainingClock,
  getDrillAudioEngine,
  useDrillStore,
  useSettingsStore,
  type DrillStatus,
} from '@/state';
import type { CueEvent, ScanVerification } from '@/types';
import { createId } from '@/utils';
import { systemRng } from '@/utils/random';

import {
  initialSchedulerState,
  nextIntervalMs,
  pickCue,
  type SchedulerState,
} from './CueScheduler';
import { getDrillModeBehavior, type DrillModeBehavior } from './modes';

const TICK_MS = 250;
const DEFAULT_FLOOR_MS = 1500;
const KEEP_AWAKE_TAG = 'halfturn-drill';
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export interface UseDrillEngineResult {
  status: DrillStatus;
  /** 3 / 2 / 1 then 0 (= "GO") during countdown; null otherwise. */
  countdownValue: number | null;
  elapsedMs: number;
  remainingMs: number;
  currentCue: CueEvent | null;
  currentPhrase: string | null;
  cueCount: number;
  timeRemainingLabel: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  testAudio: () => void;
}

/**
 * Drives a drill end-to-end: countdown → running → finish, off a single 250ms
 * tick loop. Intended for a single consumer (the active drill screen).
 */
export function useDrillEngine(): UseDrillEngineResult {
  const status = useDrillStore((s) => s.status);
  const elapsedMs = useDrillStore((s) => s.durationDrillMs);
  const remainingMs = useDrillStore((s) => s.timeRemainingMs);
  const currentCueEvent = useDrillStore((s) => {
    const last = s.cueEvents[s.cueEvents.length - 1];
    return last ?? null;
  });
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const cueCount = useDrillStore((s) => s.cuesFired);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  const t0Ref = useRef(0);
  const pausedAccumRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);
  const nextCueAtRef = useRef(0);
  const plannedAtRef = useRef(0);
  const seqRef = useRef(0);
  const schedulerRef = useRef<SchedulerState>(initialSchedulerState());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finalizedRef = useRef(false);
  const engineRef = useRef<AudioCueEngine | null>(null);
  const verifierRef = useRef<PoseVerifier | null>(null);
  const behaviorRef = useRef<DrillModeBehavior | null>(null);
  const runConfigRef = useRef<ReturnType<typeof useDrillStore.getState>['config'] | null>(
    null,
  );
  const sessionIdRef = useRef<string | null>(null);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearCountdownTimers = useCallback(() => {
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
  }, []);

  const ensureEngine = useCallback((): AudioCueEngine => {
    if (!engineRef.current) {
      engineRef.current = getDrillAudioEngine();
    }
    return engineRef.current;
  }, []);

  const finalize = useCallback(
    async (completed: boolean) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      stopTick();
      clearCountdownTimers();
      void engineRef.current?.stop();
      releaseBeep();

      const verifier = verifierRef.current;
      verifierRef.current = null;

      const store = useDrillStore.getState();
      const runCfg = runConfigRef.current ?? store.config;
      const endedAt = Date.now();
      const pausedSoFar =
        pausedAccumRef.current +
        (pauseStartedRef.current != null
          ? Date.now() - pauseStartedRef.current
          : 0);
      const drillMs = t0Ref.current
        ? clamp(Date.now() - t0Ref.current - pausedSoFar, 0, durationMsRef.current)
        : store.durationDrillMs;
      const actualDurationSec = drillMs / 1000;

      let verification: ScanVerification | null = null;
      try {
        const scans = (await verifier?.stop()) ?? [];
        if (verifier?.available) {
          verification = computeScanVerification(
            scans,
            store.cueEvents,
            actualDurationSec,
            verifier.engine ?? 'vision',
            undefined,
            { quality: verifier.quality?.() ?? undefined },
          );
        }
      } catch (err) {
        console.warn('[drill] verification failed', err);
      }

      // Hand finish + persist to the store facade (keeps SQLite path in one place).
      useDrillStore.setState({
        status: 'finished',
        timeRemainingMs: 0,
        durationDrillMs: drillMs,
        endedAtWallMs: endedAt,
        persistStatus: 'saving',
        persistError: null,
        lastVerification: verification,
      });
      // Re-enter store stop path for persistence without double-finalizing clocks.
      void (async () => {
        try {
          const { saveSession, DRILL_SESSION_SCHEMA_VERSION } = await import(
            '@/services/db'
          );
          const { summarizeCueDistribution } = await import(
            '@/components/drill/sessionStats'
          );
          const snap = useDrillStore.getState();
          if (!snap.sessionId || snap.startedAtWallMs == null) return;
          await saveSession({
            id: snap.sessionId,
            startedAtWallMs: snap.startedAtWallMs,
            endedAtWallMs: snap.endedAtWallMs ?? endedAt,
            durationDrillMs: drillMs,
            mode: runCfg.mode,
            config: runCfg,
            cues: snap.cueEvents,
            distribution: summarizeCueDistribution(snap.cueEvents),
            completed,
            schemaVersion: DRILL_SESSION_SCHEMA_VERSION,
            verification,
          });
          if (useDrillStore.getState().sessionId === snap.sessionId) {
            useDrillStore.setState({
              persistStatus: 'saved',
              persistError: null,
            });
          }
        } catch (err: unknown) {
          useDrillStore.setState({
            persistStatus: 'error',
            persistError:
              err instanceof Error ? err.message : 'Save failed',
          });
        }
      })();
    },
    [clearCountdownTimers, stopTick],
  );

  const fireCue = useCallback((drillMs: number) => {
    const runCfg = runConfigRef.current;
    const engine = engineRef.current;
    const behavior = behaviorRef.current;
    if (!runCfg || !engine || !behavior) return;

    const planned = plannedAtRef.current;
    const priorState = schedulerRef.current;
    const picked = pickCue(systemRng, runCfg, priorState);
    const resolved = behavior.resolveCue(
      picked,
      systemRng,
      runCfg,
      priorState,
    );
    const phrase = resolved.phrase;
    schedulerRef.current = resolved.nextState;

    const def = getCueDefinition(picked.cue.cueId);
    const event: CueEvent = {
      id: createId('cue'),
      cueId: picked.cue.cueId,
      index: seqRef.current,
      phrase,
      onsetWallMs: Date.now(),
      onsetDrillMs: Math.round(drillMs),
      plannedOffsetMs: Math.round(planned),
      verification: null,
    };
    seqRef.current += 1;

    useDrillStore.setState((s) => ({
      currentCue: def,
      currentPhrase: phrase,
      lastCueType: picked.cue.cueId,
      cueEvents: [...s.cueEvents, event],
      cuesFired: s.cuesFired + 1,
    }));

    behavior.presentCue(phrase, engine);
    if (runCfg.haptics) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const floor = behavior.minIntervalFloorMs(phrase, engine);
    const gap = nextIntervalMs(systemRng, runCfg, floor);
    nextCueAtRef.current = Math.round(drillMs + gap);
    plannedAtRef.current = nextCueAtRef.current;
  }, []);

  const onTick = useCallback(() => {
    if (useDrillStore.getState().status !== 'running') return;
    const drillMs = Date.now() - t0Ref.current - pausedAccumRef.current;
    const dur = durationMsRef.current;
    const elapsed = clamp(drillMs, 0, dur);
    useDrillStore.setState({
      durationDrillMs: elapsed,
      timeRemainingMs: Math.max(0, dur - elapsed),
    });

    if (drillMs >= dur) {
      void finalize(true);
      return;
    }
    if (drillMs >= nextCueAtRef.current) {
      fireCue(drillMs);
    }
  }, [finalize, fireCue]);

  const startTick = useCallback(() => {
    stopTick();
    tickRef.current = setInterval(onTick, TICK_MS);
  }, [onTick, stopTick]);

  const beginRunning = useCallback(() => {
    clearCountdownTimers();
    setCountdownValue(null);
    const runCfg = runConfigRef.current;
    if (!runCfg) return;

    const now = Date.now();
    t0Ref.current = now;
    pausedAccumRef.current = 0;
    pauseStartedRef.current = null;

    useDrillStore.setState({
      status: 'running',
      startedAtWallMs: now,
      endedAtWallMs: null,
      countdownRemainingSec: 0,
      timeRemainingMs: runCfg.durationMs,
      durationDrillMs: 0,
      currentCue: null,
      currentPhrase: null,
      cuesFired: 0,
      cueEvents: [],
      lastCueType: null,
      sessionId: sessionIdRef.current ?? createId('session'),
    });

    const firstGap = nextIntervalMs(systemRng, runCfg, DEFAULT_FLOOR_MS);
    nextCueAtRef.current = firstGap;
    plannedAtRef.current = firstGap;
    startTick();
    verifierRef.current?.start(0);
  }, [clearCountdownTimers, startTick]);

  const runCountdown = useCallback(() => {
    const runCfg = runConfigRef.current;
    if (!runCfg) return;
    useDrillStore.setState({ status: 'countdown' });
    const engine = ensureEngine();
    const steps: number[] = [];
    for (let n = runCfg.countdownSec; n >= 1; n -= 1) steps.push(n);

    if (steps.length === 0) {
      beginRunning();
      return;
    }

    setCountdownValue(steps[0]!);
    useDrillStore.setState({ countdownRemainingSec: steps[0]! });
    if (runCfg.spokenCountdown) {
      void engine.speak(String(steps[0]));
    }

    steps.slice(1).forEach((n, i) => {
      countdownTimersRef.current.push(
        setTimeout(() => {
          setCountdownValue(n);
          useDrillStore.setState({ countdownRemainingSec: n });
          if (runCfg.spokenCountdown) void engine.speak(String(n));
        }, (i + 1) * 1000),
      );
    });
    countdownTimersRef.current.push(
      setTimeout(
        () => {
          setCountdownValue(0);
          beginRunning();
        },
        steps.length * 1000,
      ),
    );
  }, [beginRunning, ensureEngine]);

  const start = useCallback(() => {
    const live = useDrillStore.getState();
    if (['countdown', 'running', 'paused'].includes(live.status)) return;

    const runCfg = live.config;
    runConfigRef.current = {
      ...runCfg,
      enabledCues: [...runCfg.enabledCues],
    };
    durationMsRef.current = runCfg.durationMs;
    finalizedRef.current = false;
    seqRef.current = 0;
    schedulerRef.current = initialSchedulerState();
    pausedAccumRef.current = 0;
    pauseStartedRef.current = null;
    sessionIdRef.current = createId('session');

    const behavior = getDrillModeBehavior(runCfg.mode);
    behaviorRef.current = behavior;

    useDrillStore.setState({
      status: 'countdown',
      sessionId: sessionIdRef.current,
      cueEvents: [],
      cuesFired: 0,
      currentCue: null,
      currentPhrase: null,
      persistStatus: 'idle',
      persistError: null,
      timeRemainingMs: runCfg.durationMs,
      durationDrillMs: 0,
      countdownRemainingSec: runCfg.countdownSec,
    });

    void (async () => {
      const engine = ensureEngine();
      await engine.prepare(useSettingsStore.getState().settings);
      if (finalizedRef.current) return;

      const verifier =
        runCfg.mode === 'turn_react'
          ? await getPoseVerifierAsync()
          : behavior.resolveVerifier();
      if (finalizedRef.current) {
        void verifier.stop().catch(() => {});
        return;
      }
      verifierRef.current = verifier;
      behavior.prepareAudio(engine);

      if (runCfg.countdownSec > 0) runCountdown();
      else beginRunning();
    })();
  }, [beginRunning, ensureEngine, runCountdown]);

  const pause = useCallback(() => {
    if (useDrillStore.getState().status !== 'running') return;
    useDrillStore.setState({ status: 'paused' });
    pauseStartedRef.current = Date.now();
    void engineRef.current?.stop();
    verifierRef.current?.pause?.();
    stopTick();
  }, [stopTick]);

  const resume = useCallback(() => {
    if (useDrillStore.getState().status !== 'paused') return;
    if (pauseStartedRef.current != null) {
      pausedAccumRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    useDrillStore.setState({ status: 'running' });
    const runCfg = runConfigRef.current;
    if (runCfg) {
      const drillMs = Date.now() - t0Ref.current - pausedAccumRef.current;
      const gap = nextIntervalMs(systemRng, runCfg, DEFAULT_FLOOR_MS);
      nextCueAtRef.current = Math.round(drillMs + gap);
      plannedAtRef.current = nextCueAtRef.current;
    }
    verifierRef.current?.resume?.();
    startTick();
  }, [startTick]);

  const stop = useCallback(() => {
    void finalize(false);
  }, [finalize]);

  const testAudio = useCallback(() => {
    void (async () => {
      const engine = ensureEngine();
      await engine.prepare(useSettingsStore.getState().settings);
      await engine.speak('HalfTurn audio check');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })();
  }, [ensureEngine]);

  useEffect(() => {
    return () => {
      const s = useDrillStore.getState().status;
      if (s === 'running' || s === 'paused') {
        void finalize(false);
      } else {
        finalizedRef.current = true;
        stopTick();
        clearCountdownTimers();
        void engineRef.current?.stop();
        void verifierRef.current?.stop().catch(() => {});
        verifierRef.current = null;
        releaseBeep();
      }
    };
  }, [clearCountdownTimers, finalize, stopTick]);

  // Silence unused keep-awake tag until we wire expo-keep-awake in this hook.
  void KEEP_AWAKE_TAG;

  return {
    status,
    countdownValue,
    elapsedMs,
    remainingMs,
    currentCue: currentCueEvent,
    currentPhrase,
    cueCount,
    timeRemainingLabel: formatRemainingClock(remainingMs),
    start,
    pause,
    resume,
    stop,
    testAudio,
  };
}
