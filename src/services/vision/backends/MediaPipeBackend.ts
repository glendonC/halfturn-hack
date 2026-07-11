import type {
  BackendStartConfig,
  Landmark,
  Landmark3D,
  PerceptionBackend,
  RawPoseFrame,
} from '../PerceptionBackend';
import { canUseNativeVision } from '../runtimeGuard';

/**
 * MediaPipe Pose Landmarker backend bridge (dev-client path).
 *
 * No native package imports in this file — CameraVerifierView (once linked)
 * calls feedRawFrame() / toRawPoseFrame(); this backend forwards to the active
 * RealPoseVerifier. available() is true only when canUseNativeVision() so
 * Expo Go never selects it via the registry.
 *
 * Lifted from production; toRawPoseFrame uses a structural bundle type so we
 * do not import react-native-mediapipe-posedetection on the Expo Go graph.
 */

/** Module-level sink: the active (started) backend's frame callback, if any. */
let activeSink: ((raw: RawPoseFrame) => void) | null = null;

/** Push a raw frame into the active verifier (no-op when no drill is sampling). */
export function feedRawFrame(raw: RawPoseFrame): void {
  activeSink?.(raw);
}

/** Structural MediaPipe LIVE_STREAM result (avoids a native package import). */
export interface PoseDetectionResultBundleLike {
  results?: Array<{
    worldLandmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
    landmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
  }>;
  inferenceTime?: number;
}

/**
 * Convert a MediaPipe LIVE_STREAM result bundle into a RawPoseFrame.
 * Returns null when no pose. Capture clock ≈ Date.now() − inferenceTime.
 */
export function toRawPoseFrame(
  bundle: PoseDetectionResultBundleLike,
): RawPoseFrame | null {
  const result = bundle.results?.[0];
  const world = result?.worldLandmarks?.[0];
  if (!world || world.length === 0) return null;
  const image = result?.landmarks?.[0] ?? world;

  const captureClockMs = Date.now() - (bundle.inferenceTime ?? 0);
  const worldOut: Landmark3D[] = world.map((l) => ({
    x: l.x,
    y: l.y,
    z: l.z,
    visibility: l.visibility,
  }));
  const landmarks: Landmark[] = image.map((l) => ({
    x: l.x,
    y: l.y,
    z: l.z,
    visibility: l.visibility,
  }));
  const visSource = image.length === world.length ? image : world;
  const visibility = visSource.map((l) => l.visibility ?? 0);

  return {
    captureClockMs,
    landmarks,
    world: worldOut,
    visibility,
    modelId: 'pose_landmarker_lite',
    inferenceMs: bundle.inferenceTime,
  };
}

export class MediaPipeBackend implements PerceptionBackend {
  readonly id = 'mediapipe';
  readonly version = 'pose-lite-0.4.0';
  private cb: ((raw: RawPoseFrame) => void) | null = null;

  async available(): Promise<boolean> {
    return canUseNativeVision();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start(_cfg?: BackendStartConfig): void {
    activeSink = (raw) => this.cb?.(raw);
  }

  onRawPose(cb: (raw: RawPoseFrame) => void): void {
    this.cb = cb;
  }

  stop(): void {
    activeSink = null;
    this.cb = null;
  }
}
