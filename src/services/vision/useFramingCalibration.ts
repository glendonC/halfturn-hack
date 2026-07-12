import { useCallback, useRef, useState } from 'react';

import { isInFrame } from '@/constants/visionTuning';
import type { RawPoseFrame } from './PerceptionBackend';
import { useCalibrationStore } from './calibration';
import { computeTorsoYawDeg, resolveYawSign } from './YawFusion';

/**
 * Framing/calibration state machine — the logic behind the framing screen,
 * extracted so the screen stays presentational. It captures the two things
 * calibration resolves (perception-architecture §3):
 *   1. the neutral (back-to-camera) torso-yaw baseline, and
 *   2. the yaw SIGN (which rotation is the player's left, given the front-camera
 *      mirror), via the pure `resolveYawSign`.
 *
 * Pure vision math lives in YawFusion; this hook only sequences the two timed
 * captures and persists the resulting profile. No camera/native imports — the
 * screen wires a `LazyCameraVerifier`'s `onSample`/`onTracking` into it.
 *
 * `coachPulse` is a monotonic signal so the screen can drive eyes-off audio
 * (hold / got-it / retry) without owning the capture timers.
 */

export type FramingPhase = 'center' | 'left' | 'ready';

/** Eyes-off coaching beat emitted around each capture. */
export type FramingCoachKind = 'hold' | 'ok' | 'retry';

export interface FramingCoachPulse {
  /** Monotonic id so React effects re-fire on repeated kinds. */
  id: number;
  kind: FramingCoachKind;
}

/** How long each capture averages frames for, ms. */
const CAPTURE_MS = 1500;
/** Minimum in-frame samples for a capture to count (else retry). */
const MIN_SAMPLES = 5;
/** MediaPipe BlazePose shoulder indices (confidence = min shoulder visibility). */
const L_SHOULDER = 11;
const R_SHOULDER = 12;

const INSTRUCTIONS: Record<FramingPhase, string> = {
  center: 'Stand with your BACK to the phone, in frame, then hold still.',
  left: 'Now turn to your LEFT and hold until capture finishes.',
  ready: 'Calibrated. Mount the phone and start when ready.',
};

/** Short spoken lines for eyes-off coaching (kept distinct from on-screen copy). */
export const FRAMING_SPOKEN: Record<FramingPhase, string> = {
  center: 'Back to the phone. Get in frame, tap Capture, then hold still.',
  left: 'Turn left, tap Capture, then hold.',
  ready: 'Calibrated. Mount the phone and start when ready.',
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export interface FramingCalibration {
  phase: FramingPhase;
  /** True while a timed capture is averaging frames. */
  capturing: boolean;
  /** Latest tracking confidence (min shoulder visibility), 0..1. */
  confidence: number;
  /** Instruction copy for the current phase. */
  instruction: string;
  /** Whether a calibration profile is already saved ("Use last setup"). */
  hasSaved: boolean;
  /** Latest capture coaching beat (hold / ok / retry), or null before any capture. */
  coachPulse: FramingCoachPulse | null;
  /** Wire to the camera's onSample: collects torso-yaw during a capture. */
  onSample: (raw: RawPoseFrame) => void;
  /** Wire to the camera's onTracking: drives the in-frame indicator. */
  onTracking: (confidence: number) => void;
  /** Run the capture for the current phase (center → left → ready). */
  capture: () => void;
}

export function useFramingCalibration(): FramingCalibration {
  const profile = useCalibrationStore((s) => s.profile);
  const setProfile = useCalibrationStore((s) => s.setProfile);

  const [phase, setPhase] = useState<FramingPhase>('center');
  const [capturing, setCapturing] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [coachPulse, setCoachPulse] = useState<FramingCoachPulse | null>(null);

  const samplesRef = useRef<number[]>([]);
  const capturingRef = useRef(false);
  const baselineRef = useRef<number | null>(null);
  const pulseIdRef = useRef(0);

  const pulse = useCallback((kind: FramingCoachKind) => {
    pulseIdRef.current += 1;
    setCoachPulse({ id: pulseIdRef.current, kind });
  }, []);

  const onSample = useCallback((raw: RawPoseFrame) => {
    if (!capturingRef.current) return;
    const conf = Math.min(raw.visibility?.[L_SHOULDER] ?? 0, raw.visibility?.[R_SHOULDER] ?? 0);
    if (!isInFrame(conf)) return;
    samplesRef.current.push(computeTorsoYawDeg(raw));
  }, []);

  const runCapture = useCallback(
    (onDone: (avg: number | null) => void) => {
      samplesRef.current = [];
      capturingRef.current = true;
      setCapturing(true);
      pulse('hold');
      setTimeout(() => {
        capturingRef.current = false;
        setCapturing(false);
        const xs = samplesRef.current;
        onDone(xs.length >= MIN_SAMPLES ? mean(xs) : null);
      }, CAPTURE_MS);
    },
    [pulse],
  );

  const capture = useCallback(() => {
    if (capturingRef.current) return;
    if (phase === 'center') {
      runCapture((avg) => {
        if (avg == null) {
          pulse('retry');
          return;
        }
        baselineRef.current = avg;
        pulse('ok');
        setPhase('left');
      });
    } else if (phase === 'left') {
      runCapture((avg) => {
        const baseline = baselineRef.current;
        if (avg == null || baseline == null) {
          pulse('retry');
          return;
        }
        const yawSign = resolveYawSign(baseline, avg);
        setProfile({ neutralYawBaselineDeg: baseline, yawSign, capturedAtEpochMs: Date.now() });
        pulse('ok');
        setPhase('ready');
      });
    }
  }, [phase, pulse, runCapture, setProfile]);

  return {
    phase,
    capturing,
    confidence,
    instruction: INSTRUCTIONS[phase],
    hasSaved: profile.capturedAtEpochMs > 0,
    coachPulse,
    onSample,
    onTracking: setConfidence,
    capture,
  };
}
