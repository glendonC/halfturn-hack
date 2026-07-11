/**
 * Frozen expected output for the synthetic golden trace. This is the tripwire:
 * any change to fuse/detectScans/computeScanVerification/enrichment (or the
 * RealPoseVerifier clock normalization) that alters these values must be a DELIBERATE
 * fixture update.
 *
 * Assertion strategy (see the golden replay test): integer-ms timestamps, direction,
 * counts, and the whole ScanVerification object are asserted EXACTLY (all are
 * integer / rounded / small-rational, Node-version-stable). The measured-only floats
 * (`peakYawDeg`, `excursionDeg`, `peakAngularVelDegPerSec`) are asserted with a tolerance
 * — they flow from a raw `atan2` and can shift in the last ULP across a Node/V8 bump.
 * `onsetMonoMs` is exact here because both turns clamp to the rise-foot sample time.
 */

import type { ScanDirection } from '../types';

export interface ExpectedScan {
  direction: ScanDirection;
  tMonoMs: number;
  startMonoMs: number;
  endMonoMs: number;
  confidence: number;
  onsetMonoMs: number;
  /** Nominal; asserted via toBeCloseTo (atan2-derived floats). */
  peakYawDeg: number;
  excursionDeg: number;
  peakAngularVelDegPerSec: number;
}

export const EXPECTED_SCANS: ExpectedScan[] = [
  {
    direction: 'left',
    tMonoMs: 462,
    startMonoMs: 396,
    endMonoMs: 660,
    confidence: 0.9,
    onsetMonoMs: 330,
    peakYawDeg: -45,
    excursionDeg: 65,
    peakAngularVelDegPerSec: 303.03,
  },
  {
    direction: 'right',
    tMonoMs: 1254,
    startMonoMs: 1188,
    endMonoMs: 1452,
    confidence: 0.9,
    onsetMonoMs: 1122,
    peakYawDeg: 45,
    excursionDeg: 60,
    peakAngularVelDegPerSec: 303.03,
  },
];

export const EXPECTED_QUALITY = {
  trackedTimeRate: 1,
  meanPoseConfidence: 0.9,
  effectiveFps: 15.2,
};

/** Default (peak) mode: legacy avgReactionMs, metricsVersion 1, plus always-on quality. */
export const EXPECTED_VERIFICATION_PEAK = {
  metricsVersion: 1,
  scansDetected: 2,
  scansPerMinute: 60,
  leftScans: 1,
  rightScans: 1,
  avgReactionMs: 112,
  scannedBeforeActionRate: 0.5,
  engine: 'synthetic-golden',
  trackedTimeRate: 1,
  meanPoseConfidence: 0.9,
  effectiveFps: 15.2,
};

/**
 * Onset mode: metricsVersion bumps to 2. Both turns land before/around their cue
 * (onset anchors 330 / 1122 vs cues 350 / 1400), so both are classified anticipation →
 * anticipationRate 1, no genuine reaction (avgReactionMs null, distribution gated off).
 */
export const EXPECTED_VERIFICATION_ONSET = {
  metricsVersion: 2,
  scansDetected: 2,
  scansPerMinute: 60,
  leftScans: 1,
  rightScans: 1,
  avgReactionMs: null,
  scannedBeforeActionRate: 0.5,
  engine: 'synthetic-golden',
  trackedTimeRate: 1,
  meanPoseConfidence: 0.9,
  effectiveFps: 15.2,
  anticipationRate: 1,
};
