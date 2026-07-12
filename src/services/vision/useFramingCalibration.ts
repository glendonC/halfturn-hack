import { useCallback, useEffect, useRef, useState } from 'react';

import { isInFrame } from '@/constants/visionTuning';
import type { RawPoseFrame } from './PerceptionBackend';
import { useCalibrationStore } from './calibration';
import { computeTorsoYawDeg, meanFaceVis, resolveYawSign } from './YawFusion';
import {
  DEFAULT_AUTO_CAPTURE,
  appendSample,
  isPresent,
  validateCapture,
  type AutoCaptureSample,
  type CaptureFailReason,
  type CaptureSample,
} from './framingAutoCapture';

/**
 * Framing/calibration state machine — the logic behind the framing screen,
 * extracted so the screen stays presentational. It captures the two things
 * calibration resolves (perception-architecture §3):
 *   1. the neutral (back-to-camera) torso-yaw baseline, and
 *   2. the yaw SIGN (which rotation is the player's left, given the front-camera
 *      mirror), via the pure `resolveYawSign`.
 *
 * Captures are HANDS-FREE and countdown-anchored: when the player has been in
 * frame long enough (`isPresent` — presence, not stillness; see
 * framingAutoCapture's header for why), the hook starts a spoken countdown so
 * they know exactly when to freeze, runs the timed capture, then judges it
 * with `validateCapture` — a rejected capture speaks the player-fixable
 * reason (lost / moving / not turned enough) and re-arms. `capture()` remains
 * as a manual fallback (it enters the same countdown). All coaching rides on
 * `coachPulse` since the player faces away from the screen.
 */

export type FramingPhase = 'center' | 'left' | 'ready';

/** Eyes-off coaching beat: countdown start, capture ok/retry, can't-see-you. */
export type FramingCoachKind = 'countdown' | 'ok' | 'retry' | 'seek';

export interface FramingCoachPulse {
  /** Monotonic id so React effects re-fire on repeated kinds. */
  id: number;
  kind: FramingCoachKind;
  /** For 'retry': the player-fixable cause, for a targeted spoken line. */
  reason?: CaptureFailReason;
}

/** How long each capture averages frames for, ms (exported for the UI's hold-still sweep). */
export const FRAMING_CAPTURE_MS = 1500;
/** Countdown length — sized so the spoken "three, two, one, hold" lands before capture. */
const COUNTDOWN_MS = 2600;
/** Speak a "step into frame" nudge after this long without seeing the player. */
const SEEK_AFTER_MS = 10000;
/** How often the seek watchdog checks (coarse — it guards a 10s silence). */
const SEEK_POLL_MS = 2500;
/** MediaPipe BlazePose shoulder indices (confidence = min shoulder visibility). */
const L_SHOULDER = 11;
const R_SHOULDER = 12;

const INSTRUCTIONS: Record<FramingPhase, string> = {
  center: 'Stand with your BACK to the phone — when the camera sees you, it counts down and captures.',
  left: 'Now turn to your LEFT — same drill: countdown, then hold.',
  ready: 'Calibrated. Mount the phone and start when ready.',
};

/** Short spoken lines for eyes-off coaching (kept distinct from on-screen copy). */
export const FRAMING_SPOKEN: Record<FramingPhase, string> = {
  center: 'Stand with your back to the phone. When I see you, I will count down and capture.',
  left: 'Now turn to your left.',
  ready: 'Calibrated. Mount the phone and start when ready.',
};

export interface FramingCalibration {
  phase: FramingPhase;
  /** True while the pre-capture countdown is speaking. */
  countingDown: boolean;
  /** True while a timed capture is averaging frames. */
  capturing: boolean;
  /** Latest tracking confidence (min shoulder visibility), 0..1. */
  confidence: number;
  /** Instruction copy for the current phase. */
  instruction: string;
  /** Whether a calibration profile is already saved ("Use last setup"). */
  hasSaved: boolean;
  /** Latest coaching beat (countdown / ok / retry / seek), or null before any. */
  coachPulse: FramingCoachPulse | null;
  /** Wire to the camera's onSample: feeds presence detection + capture averaging. */
  onSample: (raw: RawPoseFrame) => void;
  /** Wire to the camera's onTracking: drives the in-frame indicator. */
  onTracking: (confidence: number) => void;
  /** Manual fallback: start the countdown → capture for the current phase. */
  capture: () => void;
}

export function useFramingCalibration(): FramingCalibration {
  const profile = useCalibrationStore((s) => s.profile);
  const setProfile = useCalibrationStore((s) => s.setProfile);

  const [phase, setPhase] = useState<FramingPhase>('center');
  const [countingDown, setCountingDown] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [coachPulse, setCoachPulse] = useState<FramingCoachPulse | null>(null);

  const samplesRef = useRef<CaptureSample[]>([]);
  const busyRef = useRef(false); // countdown OR capture in flight
  const capturingRef = useRef(false); // set synchronously with the capture window
  const baselineRef = useRef<number | null>(null);
  const pulseIdRef = useRef(0);

  const windowRef = useRef<AutoCaptureSample[]>([]);
  const armedAtRef = useRef(0);
  const lastSeenRef = useRef(Date.now());
  const phaseRef = useRef<FramingPhase>('center');
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Countdown/capture timers must not outlive the screen.
  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
    },
    [],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms));
  }, []);

  const pulse = useCallback((kind: FramingCoachKind, reason?: CaptureFailReason) => {
    pulseIdRef.current += 1;
    setCoachPulse({ id: pulseIdRef.current, kind, reason });
  }, []);

  /** Judge a finished capture and advance the phase machine. */
  const settleCapture = useCallback(
    (capturePhase: 'center' | 'left') => {
      const result = validateCapture(samplesRef.current, capturePhase, baselineRef.current);
      if (__DEV__) {
        const s = result.stats;
        console.log(
          `[framing] ${capturePhase} capture ${result.ok ? 'ok' : `rejected (${result.reason})`}` +
            (s
              ? ` n=${s.n} median=${s.medianDeg.toFixed(1)}° mad=${s.madDeg.toFixed(1)}° drift=${s.driftDeg.toFixed(1)}° faceVis=${s.faceVisMedian.toFixed(2)}`
              : ' n=0'),
        );
      }
      if (!result.ok) {
        pulse('retry', result.reason);
        return;
      }
      if (capturePhase === 'center') {
        baselineRef.current = result.avgYawDeg;
        pulse('ok');
        setPhase('left');
        return;
      }
      const yawSign = resolveYawSign(baselineRef.current as number, result.avgYawDeg);
      setProfile({
        neutralYawBaselineDeg: baselineRef.current as number,
        yawSign,
        capturedAtEpochMs: Date.now(),
      });
      pulse('ok');
      setPhase('ready');
    },
    [pulse, setProfile],
  );

  /** Countdown → timed capture → validation, for the current phase. */
  const beginCountdown = useCallback(() => {
    const capturePhase = phaseRef.current;
    if (busyRef.current || capturePhase === 'ready') return;
    busyRef.current = true;
    setCountingDown(true);
    pulse('countdown');
    later(() => {
      setCountingDown(false);
      samplesRef.current = [];
      capturingRef.current = true;
      setCapturing(true);
      later(() => {
        capturingRef.current = false;
        setCapturing(false);
        busyRef.current = false;
        windowRef.current = [];
        // Refractory before presence can re-arm, so ok/retry lines can play.
        armedAtRef.current = Date.now() + DEFAULT_AUTO_CAPTURE.rearmMs;
        settleCapture(capturePhase as 'center' | 'left');
      }, FRAMING_CAPTURE_MS);
    }, COUNTDOWN_MS);
  }, [later, pulse, settleCapture]);

  const beginCountdownRef = useRef(beginCountdown);
  useEffect(() => {
    beginCountdownRef.current = beginCountdown;
  }, [beginCountdown]);

  const onSample = useCallback((raw: RawPoseFrame) => {
    const conf = Math.min(raw.visibility?.[L_SHOULDER] ?? 0, raw.visibility?.[R_SHOULDER] ?? 0);
    if (!isInFrame(conf)) return;
    const now = Date.now();
    lastSeenRef.current = now;
    if (capturingRef.current) {
      samplesRef.current.push({ yawDeg: computeTorsoYawDeg(raw), faceVis: meanFaceVis(raw) });
      return;
    }
    if (busyRef.current || phaseRef.current === 'ready') return;
    windowRef.current = appendSample(windowRef.current, {
      tMs: now,
      yawDeg: computeTorsoYawDeg(raw),
    });
    if (isPresent({ samples: windowRef.current, nowMs: now, armedAtMs: armedAtRef.current })) {
      beginCountdownRef.current();
    }
  }, []);

  // Seek watchdog: presence only runs when samples ARRIVE, so a player who
  // never enters frame would otherwise get silence. Nudge every ~10s unseen.
  useEffect(() => {
    if (phase === 'ready') return;
    const id = setInterval(() => {
      if (busyRef.current) return;
      const now = Date.now();
      if (now - lastSeenRef.current >= SEEK_AFTER_MS) {
        lastSeenRef.current = now; // re-arm so the nudge repeats, not spams
        pulse('seek');
      }
    }, SEEK_POLL_MS);
    return () => clearInterval(id);
  }, [phase, pulse]);

  return {
    phase,
    countingDown,
    capturing,
    confidence,
    instruction: INSTRUCTIONS[phase],
    hasSaved: profile.capturedAtEpochMs > 0,
    coachPulse,
    onSample,
    onTracking: setConfidence,
    capture: beginCountdown,
  };
}
