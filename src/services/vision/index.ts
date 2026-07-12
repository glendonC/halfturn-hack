/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports on the audio Train path.
 */

import { pickBackend } from './backends/registry';
import { DEFAULT_ONE_EURO_CONFIG } from './OneEuroFilter';
import { useCalibrationStore } from './calibration';
import { NullPoseVerifier, type PoseVerifier } from './PoseVerifier';
import { RealPoseVerifier } from './RealPoseVerifier';
import { canUseNativeVision } from './runtimeGuard';
import { DEFAULT_SCAN_DETECT_CONFIG, type EnrichmentConfig } from './types';

export type {
  VerificationOutcome,
  VerificationResult,
  YawSample,
  YawSampleBackend,
} from '@/types';

export type { PoseVerifier } from './PoseVerifier';
export { NullPoseVerifier } from './PoseVerifier';

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
  computeScanVerification,
  computeTrackingQuality,
  detectScans,
  type ScanVerificationOptions,
} from './scanDetect';
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
  FRAMING_SPOKEN,
  FRAMING_CAPTURE_MS,
  type FramingCalibration,
  type FramingPhase,
  type FramingCoachKind,
  type FramingCoachPulse,
} from './useFramingCalibration';
export {
  POSE_OVERLAY_LANDMARKS,
  POSE_OVERLAY_IDX,
  POSE_OVERLAY_EDGES,
  createPoseOverlayFeed,
  landmarksToOverlayFrame,
  type PoseViewPoint,
  type PoseOverlayFrame,
  type PoseOverlayFeed,
  type OverlayViewConverter,
} from './poseOverlay';
export { LazyCameraVerifier } from './LazyCameraVerifier';
export type { CameraVerifierProps } from './CameraVerifierView';
export {
  RealPoseVerifier,
  isRealPoseVerifier,
} from './RealPoseVerifier';
export { DEFAULT_ENRICHMENT } from './types';
export {
  recordFrameStat,
  readDiagnostics,
  resetDiagnostics,
  summarizeFrameStats,
  type FrameStat,
  type VisionDiagnostics,
} from './diagnostics';
export {
  CAPTURE_ENABLED,
  finalizeCapture,
  emitCaptureToConsole,
  resetCapture,
  serializeBundle,
  toCaptureChunks,
  fromCaptureChunks,
  type DerivedCaptureBundle,
} from './frameCapture';

/**
 * Env intent flag (EXPO_PUBLIC_VISION=1). Prefer {@link canUseNativeVision} at
 * call sites — Expo Go must never load native vision even if this is set.
 */
export const VISION_ENABLED = process.env.EXPO_PUBLIC_VISION === '1';

export const REACTION_ONSET_ENABLED = process.env.EXPO_PUBLIC_ENRICH === '1';
export const RUNTIME_ENRICHMENT: EnrichmentConfig = {
  smoothing: process.env.EXPO_PUBLIC_SMOOTH === '1' ? DEFAULT_ONE_EURO_CONFIG : null,
  reactionMode: REACTION_ONSET_ENABLED ? 'onset' : 'peak',
};

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
  return new RealPoseVerifier(
    backend,
    calibration,
    DEFAULT_SCAN_DETECT_CONFIG,
    undefined,
    RUNTIME_ENRICHMENT,
  );
}
