/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports on the audio Train path.
 */

import { pickBackend } from './backends/registry';
import { useCalibrationStore } from './calibration';
import { NullPoseVerifier, type PoseVerifier } from './PoseVerifier';
import { RealPoseVerifier } from './RealPoseVerifier';
import { canUseNativeVision } from './runtimeGuard';

export type {
  VerificationOutcome,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
  YawSampleBackend,
} from '@/types';

export type { PoseVerifier } from './PoseVerifier';
export { NullPoseVerifier } from './PoseVerifier';

/** @deprecated Prefer YawSampleBackend from @/types; frame backends use vision PerceptionBackend. */
export type { PerceptionBackend as YawSamplePerceptionBackend } from '@/types';

export {
  DEFAULT_SCAN_DETECT_CONFIG,
  DEFAULT_CALIBRATION,
  type CalibrationProfile,
  type EnrichmentConfig,
  type PoseSample,
  type ReactionMode,
  type ScanDetectConfig,
  type ScanDirection,
  type ScanEvent,
  type TrackingQuality,
} from './types';
export {
  computeScanMetrics,
  computeScanVerification,
  computeTrackingQuality,
  detectScans,
  toScanVerification,
  type ScanVerificationOptions,
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
export {
  canUseNativeVision,
  isExpoGo,
  isVisionEnvEnabled,
} from './runtimeGuard';
export { useCalibrationStore } from './calibration';
export {
  useFramingCalibration,
  type FramingCalibration,
  type FramingPhase,
} from './useFramingCalibration';
export { LazyCameraVerifier } from './LazyCameraVerifier';
export type { CameraVerifierProps } from './CameraVerifierView';
export {
  RealPoseVerifier,
  isRealPoseVerifier,
} from './RealPoseVerifier';
export { DEFAULT_ENRICHMENT } from './types';

/**
 * Env intent flag (EXPO_PUBLIC_VISION=1). Prefer {@link canUseNativeVision} at
 * call sites — Expo Go must never load native vision even if this is set.
 */
export const VISION_ENABLED = process.env.EXPO_PUBLIC_VISION === '1';

/** Synchronous factory — always the no-op verifier (Expo-Go-safe). */
export function createPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}

/**
 * Async factory: RealPoseVerifier when native vision is allowed and a backend
 * is available; otherwise NullPoseVerifier (Expo Go default).
 */
export async function getPoseVerifierAsync(): Promise<PoseVerifier> {
  if (!canUseNativeVision()) return new NullPoseVerifier();
  const backend = await pickBackend();
  if (backend.id === 'null') return new NullPoseVerifier();
  const calibration = useCalibrationStore.getState().profile;
  return new RealPoseVerifier(backend, calibration);
}
