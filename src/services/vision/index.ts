import { CUE_GATE } from '@/constants/visionTuning';

import { pickBackend } from './backends/registry';
import { TUNED_ONE_EURO_CONFIG } from './OneEuroFilter';
import { NullPoseVerifier, type PoseVerifier } from './PoseVerifier';
import { RealPoseVerifier } from './RealPoseVerifier';
import { useCalibrationStore } from './calibration';
import { getActivePoseModel } from './poseModelStore';
import { deriveNeutralMaxYawDeg, deriveScanDetectConfig } from './thresholdAdapt';
import { DEFAULT_SCAN_DETECT_CONFIG, type EnrichmentConfig } from './types';

/**
 * Camera verification is OFF unless explicitly enabled in a dev build via the
 * `EXPO_PUBLIC_VISION` env flag. It is never set in Expo Go, so the Expo Go
 * bundle resolves to the no-op NullPoseVerifier and never loads a camera
 * backend. (Native backends are reached only through the dynamic imports in
 * backends/registry.ts; the CI guard fails if vision-camera leaks elsewhere.)
 */
export const VISION_ENABLED = process.env.EXPO_PUBLIC_VISION === '1';

/**
 * Body-signal enrichment toggles (§9), resolved once from env flags. Default OFF keeps
 * today's exact behavior; each is an opt-in A/B. `EXPO_PUBLIC_ENRICH` flips reaction to
 * onset (metricsVersion 2); `EXPO_PUBLIC_SMOOTH` applies One-Euro to the DETECTION stream
 * (kept separate because it changes which scans are detected — see sampleSmoothing.ts).
 */
export const REACTION_ONSET_ENABLED = process.env.EXPO_PUBLIC_ENRICH === '1';
export const RUNTIME_ENRICHMENT: EnrichmentConfig = {
  // TUNED, not DEFAULT: the library's generic tune measurably makes detection worse on this signal
  // (phantoms 181 → 291). See OneEuroFilter.ts and docs/scan-tracking-architecture.md §10c.
  smoothing: process.env.EXPO_PUBLIC_SMOOTH === '1' ? TUNED_ONE_EURO_CONFIG : null,
  reactionMode: REACTION_ONSET_ENABLED ? 'onset' : 'peak',
};

/**
 * Per-player scan thresholds, scaled from the noise floor the player's own framing calibration
 * measured (`thresholdAdapt.ts`). OFF by default: it changes which scans are detected, so it ships
 * behind a flag until a field trace clears its bar — even though the fixed default it replaces is
 * known to be broken (§10c). Profiles captured before the noise floor was measured fall back to the
 * fixed default regardless of this flag.
 */
export const ADAPTIVE_THRESHOLDS_ENABLED = process.env.EXPO_PUBLIC_ADAPT === '1';

/** Synchronous factory — always the no-op verifier (Expo-Go-safe). */
export function getPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}

/**
 * Async factory — resolves the real, backend-backed verifier when camera
 * verification is enabled and a backend is available; otherwise the no-op
 * verifier. The drill engine awaits this in its async start prelude.
 */
export async function getPoseVerifierAsync(): Promise<PoseVerifier> {
  if (!VISION_ENABLED) return new NullPoseVerifier();
  // Resolve the pose variant once per run and hand it to the backend, so every sample and the
  // engine label this run produces name the same model (a benchmark arm has to be attributable).
  const backend = await pickBackend(getActivePoseModel());
  if (backend.id === 'null') return new NullPoseVerifier();
  const calibration = useCalibrationStore.getState().profile;
  // Scan thresholds and the cue-gate band are resolved TOGETHER, from the same measured noise
  // floor, so they can never disagree about what "neutral" means.
  const scanConfig = ADAPTIVE_THRESHOLDS_ENABLED
    ? deriveScanDetectConfig(DEFAULT_SCAN_DETECT_CONFIG, calibration)
    : DEFAULT_SCAN_DETECT_CONFIG;
  const neutralBand = ADAPTIVE_THRESHOLDS_ENABLED
    ? deriveNeutralMaxYawDeg(calibration, scanConfig)
    : CUE_GATE.neutralMaxYawDeg;
  return new RealPoseVerifier(
    backend,
    calibration,
    scanConfig,
    undefined,
    RUNTIME_ENRICHMENT,
    neutralBand,
  );
}

export { NullPoseVerifier } from './PoseVerifier';
export type { PoseVerifier } from './PoseVerifier';
export { RealPoseVerifier } from './RealPoseVerifier';
export { LazyCameraVerifier } from './LazyCameraVerifier';
export {
  detectScans,
  computeScanVerification,
  computeCuedDirectionAccuracy,
  computeTrackingQuality,
  type CuedTurnScore,
  type ScanVerificationOptions,
} from './scanDetect';
export {
  POSE_MODELS,
  POSE_MODEL_IDS,
  DEFAULT_POSE_MODEL,
  DEFAULT_POSE_MODEL_SPEC,
  resolvePoseModel,
  type PoseModelId,
  type PoseModelSpec,
} from './poseModel';
export { usePoseModelStore, getActivePoseModel } from './poseModelStore';
export { smoothPoseSamples } from './sampleSmoothing';
export {
  fuse,
  computeTorsoYawDeg,
  computeHipYawDeg,
  shoulderHipSeparationDeg,
  computeNeutralBaselineDeg,
  meanFaceVis,
  resolveYawSign,
  type FusedReading,
} from './YawFusion';
export {
  OneEuroFilter,
  DEFAULT_ONE_EURO_CONFIG,
  TUNED_ONE_EURO_CONFIG,
  type OneEuroConfig,
} from './OneEuroFilter';
export {
  deriveScanDetectConfig,
  deriveNeutralMaxYawDeg,
  hasNoiseFloor,
  DEFAULT_THRESHOLD_POLICY,
  type ThresholdPolicy,
} from './thresholdAdapt';
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
export { pickBackend } from './backends/registry';
export { NullBackend } from './backends/NullBackend';
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
export type {
  PerceptionBackend,
  RawPoseFrame,
  Landmark,
  Landmark3D,
  BackendStartConfig,
} from './PerceptionBackend';
export {
  DEFAULT_SCAN_DETECT_CONFIG,
  DEFAULT_CALIBRATION,
  DEFAULT_ENRICHMENT,
  type PoseSample,
  type ScanEvent,
  type ScanDirection,
  type ScanDetectConfig,
  type CalibrationProfile,
  type ReactionMode,
  type TrackingQuality,
  type EnrichmentConfig,
} from './types';
