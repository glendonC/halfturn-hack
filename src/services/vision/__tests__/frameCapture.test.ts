/**
 * Unit tests for the derived-trace capture (frameCapture.ts). Covers the pure
 * chunk/reassemble round-trip (the dep-free export contract), the two-site bundle
 * assembly (verifier stashes samples+scans; the engine completes with cues+duration),
 * and the default-OFF gate (capture must not run without an explicit opt-in).
 */

import type { CueEvent } from '@/types';
import {
  CAPTURE_ENABLED,
  finalizeCapture,
  fromCaptureChunks,
  recordVerifierRun,
  resetCapture,
  serializeBundle,
  toCaptureChunks,
  type DerivedCaptureBundle,
} from '../frameCapture';
import type { CalibrationProfile, PoseSample, ScanDetectConfig, ScanEvent } from '../types';

const CALIB: CalibrationProfile = { neutralYawBaselineDeg: 0, yawSign: 1, capturedAtEpochMs: 0 };
const CFG: ScanDetectConfig = {
  yawEnterDeg: 28,
  yawExitDeg: 15,
  minHoldMs: 150,
  minConfidence: 0.5,
  refractoryMs: 400,
  scanBeforeWindowMs: 2500,
};
const SAMPLES: PoseSample[] = [
  { tMonoMs: 0, yawDeg: 0, confidence: 0.9 },
  { tMonoMs: 66, yawDeg: -30, confidence: 0.9 },
];
const SCANS: ScanEvent[] = [
  { tMonoMs: 66, direction: 'left', peakYawDeg: -30, startMonoMs: 66, endMonoMs: 132, confidence: 0.9 },
];
const CUES: CueEvent[] = [
  { id: 'cue-0', cueId: 'turn', index: 0, phrase: 'Turn', onsetWallMs: 0, onsetDrillMs: 40, plannedOffsetMs: 40 },
];
const ENRICH = { smoothing: null, reactionMode: 'peak' as const };

afterEach(() => resetCapture());

describe('frameCapture', () => {
  it('is disabled by default (no capture without an explicit opt-in)', () => {
    // __DEV__ is true under jest-expo but EXPO_PUBLIC_CAPTURE is unset.
    expect(CAPTURE_ENABLED).toBe(false);
  });

  it('assembles a derived bundle from the verifier run + the engine timeline', () => {
    recordVerifierRun({
      engineLabel: 'fake@test-1',
      calibration: CALIB,
      scanDetectConfig: CFG,
      enrichment: ENRICH,
      samples: SAMPLES,
      scans: SCANS,
    });
    const bundle = finalizeCapture(CUES, 2, 1_700_000_000_000);
    expect(bundle).not.toBeNull();
    const b = bundle as DerivedCaptureBundle;
    expect(b.synthetic).toBe(false);
    expect(b.engineLabel).toBe('fake@test-1');
    expect(b.enrichment).toEqual(ENRICH);
    expect(b.samples).toHaveLength(2);
    expect(b.scans).toEqual(SCANS);
    expect(b.cues).toEqual(CUES);
    expect(b.actualDurationSec).toBe(2);
    expect(b.capturedAtEpochMs).toBe(1_700_000_000_000);
  });

  it('is single-shot: a second finalize with no new run yields null', () => {
    recordVerifierRun({ engineLabel: 'e', calibration: CALIB, scanDetectConfig: CFG, enrichment: ENRICH, samples: SAMPLES, scans: SCANS });
    expect(finalizeCapture(CUES, 2, 0)).not.toBeNull();
    expect(finalizeCapture(CUES, 2, 0)).toBeNull();
  });

  it('returns null when nothing was recorded', () => {
    expect(finalizeCapture(CUES, 2, 0)).toBeNull();
  });

  it('carries no raw landmark keys in the serialized derived bundle', () => {
    recordVerifierRun({ engineLabel: 'e', calibration: CALIB, scanDetectConfig: CFG, enrichment: ENRICH, samples: SAMPLES, scans: SCANS });
    const json = serializeBundle(finalizeCapture(CUES, 2, 0) as DerivedCaptureBundle);
    for (const key of ['"landmarks"', '"world"', '"visibility"']) {
      expect(json.includes(key)).toBe(false);
    }
  });

  it('round-trips a serialized bundle through chunk/reassemble with no loss', () => {
    recordVerifierRun({ engineLabel: 'e', calibration: CALIB, scanDetectConfig: CFG, enrichment: ENRICH, samples: SAMPLES, scans: SCANS });
    const json = serializeBundle(finalizeCapture(CUES, 2, 0) as DerivedCaptureBundle);
    // Small chunk size forces multiple chunks (exercises the fence + index reassembly).
    const chunks = toCaptureChunks(json, 16);
    expect(chunks.length).toBeGreaterThan(3); // BEGIN + several bodies + END
    expect(fromCaptureChunks(chunks)).toBe(json);
    expect(JSON.parse(fromCaptureChunks(chunks))).toEqual(JSON.parse(json));
  });
});
