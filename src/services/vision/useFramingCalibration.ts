import { useCallback, useRef, useState } from 'react';

import { isInFrame } from '@/constants/visionTuning';

import type { RawPoseFrame } from './PerceptionBackend';
import { useCalibrationStore } from './calibration';
import { computeTorsoYawDeg, resolveYawSign } from './YawFusion';

/**
 * Framing/calibration state machine — no camera/native imports.
 * Screens wire LazyCameraVerifier onSample/onTracking into this hook.
 * On Expo Go (no frames), capture simply fails the min-sample gate.
 */

export type FramingPhase = 'center' | 'left' | 'ready';

const CAPTURE_MS = 1500;
const MIN_SAMPLES = 5;
const L_SHOULDER = 11;
const R_SHOULDER = 12;

const INSTRUCTIONS: Record<FramingPhase, string> = {
  center: 'Stand with your BACK to the phone, in frame, then hold still.',
  left: 'Now turn to your LEFT and hold until capture finishes.',
  ready: 'Calibrated. Mount the phone and start when ready.',
};

const mean = (xs: number[]) =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export interface FramingCalibration {
  phase: FramingPhase;
  capturing: boolean;
  confidence: number;
  instruction: string;
  hasSaved: boolean;
  onSample: (raw: RawPoseFrame) => void;
  onTracking: (confidence: number) => void;
  capture: () => void;
  /** Skip capture and use identity / last saved profile. */
  useLastOrDefault: () => void;
}

export function useFramingCalibration(): FramingCalibration {
  const profile = useCalibrationStore((s) => s.profile);
  const setProfile = useCalibrationStore((s) => s.setProfile);

  const [phase, setPhase] = useState<FramingPhase>('center');
  const [capturing, setCapturing] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const samplesRef = useRef<number[]>([]);
  const capturingRef = useRef(false);
  const baselineRef = useRef<number | null>(null);

  const onSample = useCallback((raw: RawPoseFrame) => {
    if (!capturingRef.current) return;
    const conf = Math.min(
      raw.visibility?.[L_SHOULDER] ?? 0,
      raw.visibility?.[R_SHOULDER] ?? 0,
    );
    if (!isInFrame(conf)) return;
    samplesRef.current.push(computeTorsoYawDeg(raw));
  }, []);

  const runCapture = useCallback((onDone: (avg: number | null) => void) => {
    samplesRef.current = [];
    capturingRef.current = true;
    setCapturing(true);
    setTimeout(() => {
      capturingRef.current = false;
      setCapturing(false);
      const xs = samplesRef.current;
      onDone(xs.length >= MIN_SAMPLES ? mean(xs) : null);
    }, CAPTURE_MS);
  }, []);

  const capture = useCallback(() => {
    if (capturingRef.current) return;
    if (phase === 'center') {
      runCapture((avg) => {
        if (avg == null) return;
        baselineRef.current = avg;
        setPhase('left');
      });
    } else if (phase === 'left') {
      runCapture((avg) => {
        const baseline = baselineRef.current;
        if (avg == null || baseline == null) return;
        const yawSign = resolveYawSign(baseline, avg);
        setProfile({
          neutralYawBaselineDeg: baseline,
          yawSign,
          capturedAtEpochMs: Date.now(),
        });
        setPhase('ready');
      });
    }
  }, [phase, runCapture, setProfile]);

  const useLastOrDefault = useCallback(() => {
    if (profile.capturedAtEpochMs <= 0) {
      setProfile({
        ...profile,
        capturedAtEpochMs: Date.now(),
      });
    }
    setPhase('ready');
  }, [profile, setProfile]);

  return {
    phase,
    capturing,
    confidence,
    instruction: INSTRUCTIONS[phase],
    hasSaved: profile.capturedAtEpochMs > 0,
    onSample,
    onTracking: setConfidence,
    capture,
    useLastOrDefault,
  };
}
