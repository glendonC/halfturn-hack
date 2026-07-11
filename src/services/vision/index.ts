/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports here — ever on the audio path.
 * Real backends land behind createPoseVerifier() in a later phase.
 */

import type {
  PoseVerifier,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

export type {
  PerceptionBackend,
  PoseVerifier,
  VerificationOutcome,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

export {
  DEFAULT_SCAN_DETECT_CONFIG,
  DEFAULT_CALIBRATION,
  type CalibrationProfile,
  type PoseSample,
  type ScanDetectConfig,
  type ScanDirection,
  type ScanEvent,
  type TrackingQuality,
} from './types';
export {
  computeScanMetrics,
  computeTrackingQuality,
  detectScans,
} from './scanDetect';
export { yawSamplesToPoseSamples } from './yawSampleAdapter';
export {
  DEFAULT_ONE_EURO_CONFIG,
  OneEuroFilter,
  type OneEuroConfig,
} from './OneEuroFilter';
export { smoothPoseSamples } from './sampleSmoothing';
export {
  computeHipYawDeg,
  computeNeutralBaselineDeg,
  computeTorsoYawDeg,
  fuse,
  meanFaceVis,
  resolveYawSign,
  shoulderHipSeparationDeg,
  type FusedReading,
} from './YawFusion';
export type {
  BackendStartConfig,
  FramePerceptionBackend,
  Landmark,
  Landmark3D,
  RawPoseFrame,
} from './PerceptionBackend';

/** Always available — Expo Go / audio-only / tests */
export class NullPoseVerifier implements PoseVerifier {
  calibrateBaseline(_samples: YawSample[]): void {}

  verifyCue(_args: VerifyCueArgs): VerificationResult {
    return { outcome: 'unknown', backendId: 'null' };
  }
}

export function createPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}
