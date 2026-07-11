/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports on the audio Train path.
 */

import type {
  PoseVerifier,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

import { pickBackend } from './backends/registry';

export type {
  PoseVerifier,
  VerificationOutcome,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
  YawSampleBackend,
} from '@/types';

/** @deprecated Prefer YawSampleBackend from @/types; frame backends use vision PerceptionBackend. */
export type { PerceptionBackend as YawSamplePerceptionBackend } from '@/types';

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
  Landmark,
  Landmark3D,
  PerceptionBackend,
  RawPoseFrame,
} from './PerceptionBackend';
export { NullBackend } from './backends/NullBackend';
export { pickBackend } from './backends/registry';

/**
 * Camera verification stays OFF unless explicitly unlocked in a later issue
 * via EXPO_PUBLIC_VISION=1 on a custom dev client. Never set in Expo Go.
 */
export const VISION_ENABLED = process.env.EXPO_PUBLIC_VISION === '1';

/** Always available — Expo Go / audio-only / tests */
export class NullPoseVerifier implements PoseVerifier {
  calibrateBaseline(_samples: YawSample[]): void {}

  verifyCue(_args: VerifyCueArgs): VerificationResult {
    return { outcome: 'unknown', backendId: 'null' };
  }
}

/** Synchronous factory — always the no-op verifier (Expo-Go-safe). */
export function createPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}

/**
 * Async factory: consults the backend registry when VISION_ENABLED.
 * RealPoseVerifier is not implemented yet — even an available backend falls
 * back to NullPoseVerifier until the Phase 2 unlock lands RealPoseVerifier.
 */
export async function getPoseVerifierAsync(): Promise<PoseVerifier> {
  if (!VISION_ENABLED) return new NullPoseVerifier();
  const backend = await pickBackend();
  if (backend.id === 'null') return new NullPoseVerifier();
  // Future: return new RealPoseVerifier(backend, ...)
  return new NullPoseVerifier();
}
