import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CUES } from '@/constants/cues';
import {
  configureAudioSession,
  getAudioCueEngine,
  playConfirm,
  releaseBeep,
  type AudioCueEngine,
} from '@/services/audio';
import { saveSession } from '@/services/db';
import {
  CAPTURE_ENABLED,
  computeScanVerification,
  emitCaptureToConsole,
  finalizeCapture,
  RUNTIME_ENRICHMENT,
  type PoseVerifier,
} from '@/services/vision';
import { useDrillConfigStore } from '@/state/useDrillConfigStore';
import { useSettings } from '@/state/useSettingsStore';
import { useDrillStore } from '@/state/useDrillStore';
import {
  DRILL_SESSION_SCHEMA_VERSION,
  type CueEvent,
  type CueId,
  type DrillConfig,
  type DrillSession,
  type DrillStatus,
  type ScanVerification,
  type Settings,
} from '@/types';
import { sessionId } from '@/utils/id';
import { systemRng } from '@/utils/random';
import {
  initialSchedulerState,
  nextIntervalMs,
  pickCue,
  type SchedulerState,
} from './CueScheduler';
import { getDrillModeBehavior, type DrillModeBehavior } from './modes';

const TICK_MS = 250;
const DEFAULT_FLOOR_MS = 1500; // fallback cue spacing when next phrase is unknown
const KEEP_AWAKE_TAG = 'halfturn-drill';
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Keep a drill's enabled cues within the app-wide vocabulary; never empty. */
function sanitizeConfig(config: DrillConfig, vocabulary: CueId[]): DrillConfig {
  const allowed = config.enabledCues.filter((c) => vocabulary.includes(c));
  return { ...config, enabledCues: allowed.length > 0 ? allowed : config.enabledCues };
}

function fireHaptic(cueId: CueId, enabled: boolean): void {
  if (!enabled) return;
  const category = CUES[cueId].category;
  if (cueId === 'man_on') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } else if (category === 'action') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } else if (category === 'direction') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } else {
    void Haptics.selectionAsync();
  }
}

export interface UseDrillEngineResult {
  status: DrillStatus;
  /** 3 / 2 / 1 then 0 (= "GO") during countdown; null otherwise. */
  countdownValue: number | null;
  elapsedMs: number;
  remainingMs: number;
  currentCue: CueEvent | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Speak a one-off test phrase so the player can verify audio before starting. */
  testAudio: () => void;
}

/**
 * Drives a drill end-to-end: countdown → running → finish, off a single 250ms
 * tick loop that derives the drill clock from Date.now() minus a paused
 * accumulator (robust to timer drift and pauses). Intended for a single
 * consumer (the active drill screen).
 */
export function useDrillEngine(): UseDrillEngineResult {
  const settings = useSettings();
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  // Reactive values for the HUD.
  const status = useDrillStore((s) => s.status);
  const elapsedMs = useDrillStore((s) => s.elapsedMs);
  const remainingMs = useDrillStore((s) => s.remainingMs);
  const currentCue = useDrillStore((s) => s.currentCue);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  // Loop state lives in refs so the tick reads fresh values without re-binding.
  const t0Ref = useRef(0);
  const pausedAccumRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);
  const nextCueAtRef = useRef(0);
  const plannedAtRef = useRef(0);
  const seqRef = useRef(0);
  const schedulerRef = useRef<SchedulerState>(initialSchedulerState());
  const runConfigRef = useRef<DrillConfig | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finalizedRef = useRef(false);
  const engineRef = useRef<AudioCueEngine | null>(null);
  const verifierRef = useRef<PoseVerifier | null>(null);
  const behaviorRef = useRef<DrillModeBehavior | null>(null);
  const confirmedCueSeqRef = useRef<number | null>(null);

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
      engineRef.current = getAudioCueEngine(settingsRef.current.audioSource);
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
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});

      // Detach the verifier up front so a re-entrant finalize can't double-stop it.
      const verifier = verifierRef.current;
      verifierRef.current = null;

      const store = useDrillStore.getState();
      const runCfg = runConfigRef.current ?? store.runConfig;
      if (!runCfg) {
        void verifier?.stop().catch(() => {}); // release the camera if it was live
        store.reset();
        return;
      }
      const endedAt = Date.now();
      // Fold in any still-open pause segment (e.g. Stop pressed while paused) so
      // paused wall-clock isn't counted as drill time.
      const pausedSoFar =
        pausedAccumRef.current +
        (pauseStartedRef.current != null ? Date.now() - pauseStartedRef.current : 0);
      const drillMs = t0Ref.current
        ? clamp(Date.now() - t0Ref.current - pausedSoFar, 0, durationMsRef.current)
        : 0;
      const actualDurationSec = Math.round(drillMs / 1000);

      // Stop the camera verifier and, when a real pipeline ran (turn-react in a
      // dev build), reduce its scan timeline into verification metrics on the
      // shared drill-clock axis. NullPoseVerifier (audio mode / Expo Go) yields
      // [] and `available === false`, so verification stays null — unchanged no-camera path.
      let verification: ScanVerification | null = null;
      try {
        const scans = (await verifier?.stop()) ?? [];
        if (verifier?.available) {
          verification = computeScanVerification(
            scans,
            store.events,
            actualDurationSec,
            verifier.engine ?? 'vision',
            undefined,
            {
              // Onset reaction (metricsVersion 2) when the enrichment flag is set; else
              // legacy peak-based (metricsVersion 1). Provenance/trust from the verifier.
              reactionMode: RUNTIME_ENRICHMENT.reactionMode,
              quality: verifier.quality?.() ?? undefined,
            },
          );
        }
      } catch (err) {
        console.warn('[drill] verification failed', err);
      }

      // Dev-only: complete the derived-trace capture (verifier stashed samples +
      // scans; the cue timeline + duration live here) and emit it for off-device
      // collection. Derived scalars only — never raw frames/landmarks. Inert unless
      // the capture flag is set — see frameCapture.ts.
      if (CAPTURE_ENABLED && verifier?.available) {
        try {
          const bundle = finalizeCapture(store.events, actualDurationSec, Date.now());
          if (bundle) emitCaptureToConsole(bundle);
        } catch (err) {
          console.warn('[drill] capture emit failed', err);
        }
      }

      const session: DrillSession = {
        id: sessionId(),
        startedAt: store.startedAtEpoch ?? endedAt,
        endedAt,
        plannedDurationSec: runCfg.durationSec,
        actualDurationSec,
        config: runCfg,
        totalCues: store.events.length,
        cueCounts: store.cueCounts,
        events: store.events,
        completed,
        schemaVersion: DRILL_SESSION_SCHEMA_VERSION,
        verification,
      };

      store.setResult(session);
      store.setStatus('finished');
      setCountdownValue(null);

      // Only persist sessions that actually produced cues.
      if (session.events.length > 0) {
        saveSession(session).catch((err) => console.warn('[drill] save failed', err));
      }
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
    const { cueId, side } = picked.cue;
    // The mode decides the final phrase (turn-react re-rolls the readable color
    // palette; audio passes it through) and threads the scheduler state forward.
    const resolved = behavior.resolveCue(picked, systemRng, runCfg, priorState);
    const phrase = resolved.phrase;
    schedulerRef.current = resolved.nextState;

    const event: CueEvent = {
      seq: seqRef.current,
      cueId,
      category: CUES[cueId].category,
      phrase,
      side,
      firedAtMonoMs: Math.round(drillMs),
      firedAtEpochMs: Date.now(),
      plannedOffsetMs: Math.round(planned),
    };
    seqRef.current += 1;

    useDrillStore.getState().recordCue(event);
    // Present the cue's audio: audio mode speaks the phrase; turn-react plays a
    // directionless beep (spoken value suppressed so the player must turn to read
    // it). The visual reveal is the cue surface's job (TurnReactCueDisplay).
    behavior.presentCue(phrase, engine);
    fireHaptic(cueId, settingsRef.current.hapticsEnabled);

    // Schedule the next cue. The mode floors the gap: audio at the utterance
    // length so cues never stack; turn-react at the reveal window so the next
    // cue never fires while the value is still on screen.
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
    useDrillStore.getState().setClock(elapsed, dur - elapsed);

    if (drillMs >= dur) {
      void finalize(true);
      return;
    }
    if (drillMs >= nextCueAtRef.current) {
      // Mode gate: turn-react holds a due cue until the camera sees the player
      // reset (re-checked every tick, capped by the gate itself); audio mode has
      // no gate and fires immediately.
      const overdueMs = drillMs - nextCueAtRef.current;
      const allow =
        behaviorRef.current?.allowCueNow?.(verifierRef.current, overdueMs, drillMs) ?? true;
      if (allow) fireCue(drillMs);
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
    useDrillStore.getState().markStarted(now);
    useDrillStore.getState().setStatus('running');

    const firstGap = nextIntervalMs(systemRng, runCfg, DEFAULT_FLOOR_MS);
    nextCueAtRef.current = firstGap;
    plannedAtRef.current = firstGap;
    startTick();

    // Live verified-turn loop: each scan the camera completes DURING the run is
    // matched to the cue it answered, closing the cue → turn → confirm circle in
    // the moment (ding + success haptic + on-screen pulse). One confirm per cue;
    // a scan that started before its cue fired doesn't count. UX-only — the
    // summary metrics still come from the authoritative stop() timeline.
    confirmedCueSeqRef.current = null;
    verifierRef.current?.onScan?.((scan) => {
      const store = useDrillStore.getState();
      if (store.status !== 'running') return;
      const cue = store.currentCue;
      if (!cue || scan.tMonoMs < cue.firedAtMonoMs) return;
      if (cue.side && scan.direction !== cue.side) return; // cued side must match
      if (confirmedCueSeqRef.current === cue.seq) return;
      confirmedCueSeqRef.current = cue.seq;
      store.recordScanConfirm(cue.seq, scan.direction);
      playConfirm();
      void engineRef.current?.speak('Good'); // eyes-off coach confirm
      if (settingsRef.current.hapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

    // Anchor the camera verifier to the drill-clock ORIGIN (0): the first frame
    // it sees maps to drill-time 0 — the same axis cues use (firedAtMonoMs starts
    // at 0 here). Passing t0Ref.current (an epoch) would throw scans onto a
    // different axis. No-op for NullPoseVerifier (audio mode / Expo Go).
    verifierRef.current?.start(0);
  }, [clearCountdownTimers, startTick]);

  const runCountdown = useCallback(() => {
    useDrillStore.getState().setStatus('countdown');
    const engine = ensureEngine();
    const speak = (text: string) => void engine.speak(text);

    const steps = [3, 2, 1];
    setCountdownValue(3);
    speak('3'); // also warms TTS before the first real cue
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    steps.slice(1).forEach((n, i) => {
      countdownTimersRef.current.push(
        setTimeout(() => {
          setCountdownValue(n);
          speak(String(n));
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, (i + 1) * 1000),
      );
    });
    countdownTimersRef.current.push(
      setTimeout(() => {
        setCountdownValue(0); // rendered as "GO"
        speak('Go');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 3000),
    );
    countdownTimersRef.current.push(setTimeout(() => beginRunning(), 3650));
  }, [beginRunning, ensureEngine]);

  const start = useCallback(() => {
    if (['countdown', 'running', 'paused'].includes(useDrillStore.getState().status)) return;

    const liveConfig = useDrillConfigStore.getState().config;
    const runCfg = sanitizeConfig(liveConfig, settingsRef.current.enabledVocabulary);

    useDrillStore.getState().initRun(runCfg);
    runConfigRef.current = useDrillStore.getState().runConfig; // the cloned snapshot
    durationMsRef.current = runCfg.durationSec * 1000;
    finalizedRef.current = false;
    seqRef.current = 0;
    schedulerRef.current = initialSchedulerState();
    pausedAccumRef.current = 0;
    pauseStartedRef.current = null;
    // Resolve the per-mode strategy once for this run; the engine delegates cue
    // presentation, phrase resolution, interval floor, audio prep, and verifier
    // selection to it instead of branching on the mode.
    const behavior = getDrillModeBehavior(runCfg.mode);
    behaviorRef.current = behavior;

    void (async () => {
      await configureAudioSession(settingsRef.current.audioOutputMode);
      const engine = ensureEngine();
      await engine.prepare(settingsRef.current);

      // Bail if the run was stopped during the audio-session / TTS prelude.
      if (finalizedRef.current) return;

      // Resolve the camera verifier for this run: turn-react in a dev build with
      // VISION_ENABLED resolves a real backend; everything else (audio mode,
      // Expo Go, no permission, init failure) resolves the no-op verifier.
      const verifier = await behavior.resolveVerifier();
      // Re-check AFTER the (turn-react) native-init await: if Stop was pressed or
      // the screen unmounted during it, release the just-resolved camera and bail
      // — otherwise we'd orphan a live camera and silently restart a stopped drill.
      if (finalizedRef.current) {
        void verifier.stop().catch(() => {});
        return;
      }
      verifierRef.current = verifier;
      behavior.prepareAudio(engine); // turn-react primes the beep; audio no-ops

      if (settingsRef.current.keepAwake) {
        void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      }
      if (runCfg.countdownEnabled) runCountdown();
      else beginRunning();
    })();
  }, [beginRunning, ensureEngine, runCountdown]);

  const pause = useCallback(() => {
    if (useDrillStore.getState().status !== 'running') return;
    useDrillStore.getState().setStatus('paused');
    pauseStartedRef.current = Date.now();
    void engineRef.current?.stop(); // cut any in-flight utterance (cross-platform)
    verifierRef.current?.pause?.(); // stop sampling; resume re-anchors the clock
    stopTick();
  }, [stopTick]);

  const resume = useCallback(() => {
    if (useDrillStore.getState().status !== 'paused') return;
    if (pauseStartedRef.current != null) {
      pausedAccumRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    useDrillStore.getState().setStatus('running');
    const runCfg = runConfigRef.current;
    if (runCfg) {
      const drillMs = Date.now() - t0Ref.current - pausedAccumRef.current;
      const gap = nextIntervalMs(systemRng, runCfg, DEFAULT_FLOOR_MS);
      nextCueAtRef.current = Math.round(drillMs + gap);
      plannedAtRef.current = nextCueAtRef.current;
    }
    verifierRef.current?.resume?.(); // re-anchor so paused time is excluded
    startTick();
  }, [startTick]);

  const stop = useCallback(() => {
    void finalize(false);
  }, [finalize]);

  const testAudio = useCallback(() => {
    void (async () => {
      await configureAudioSession(settingsRef.current.audioOutputMode);
      const engine = ensureEngine();
      await engine.prepare(settingsRef.current);
      void engine.speak('HalfTurn audio check');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })();
  }, [ensureEngine]);

  // If the screen unmounts mid-drill (e.g. Android back), finalize the live run
  // so a drill that already produced cues is saved as an incomplete session
  // rather than silently dropped. finalize() is idempotent and tears down timers
  // /audio/keep-awake itself; otherwise just release resources.
  useEffect(() => {
    return () => {
      const s = useDrillStore.getState().status;
      if (s === 'running' || s === 'paused') {
        void finalize(false);
      } else {
        // Mark finalized so an in-flight start() prelude (status 'countdown')
        // bails after its verifier await instead of resurrecting on an unmounted
        // screen. Harmless when idle/finished; start() resets the flag.
        finalizedRef.current = true;
        stopTick();
        clearCountdownTimers();
        void engineRef.current?.stop();
        void verifierRef.current?.stop().catch(() => {});
        verifierRef.current = null;
        releaseBeep();
        void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      }
    };
  }, [clearCountdownTimers, finalize, stopTick]);

  return {
    status,
    countdownValue,
    elapsedMs,
    remainingMs,
    currentCue,
    start,
    pause,
    resume,
    stop,
    testAudio,
  };
}
