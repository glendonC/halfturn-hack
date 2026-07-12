import type { PoseDetectionResultBundle } from 'react-native-mediapipe-posedetection';

import type {
  BackendStartConfig,
  Landmark,
  Landmark3D,
  PerceptionBackend,
  RawPoseFrame,
} from '../PerceptionBackend';
import { DEFAULT_POSE_MODEL_SPEC, type PoseModelSpec } from '../poseModel';

/**
 * MediaPipe Pose Landmarker backend (VisionCamera v4 + react-native-mediapipe-
 * posedetection). DEV-BUILD ONLY — reached exclusively through the registry's
 * dynamic import behind VISION_ENABLED; the Expo Go bundle never loads it (the
 * CI guard enforces it lives only in this allow-listed file).
 *
 * The pose library is HOOK-based (`usePoseDetection` must run in a component and
 * delivers results asynchronously on the JS thread via `onResults`), which does
 * not fit a class that "owns" frame delivery. So this backend is a thin BRIDGE:
 * `CameraVerifierView` runs the hook + camera and calls `feedRawFrame()`; the
 * started backend forwards each frame to its verifier. This keeps the frozen
 * `PerceptionBackend` seam (RealPoseVerifier / YawFusion / detectScans) unchanged.
 *
 * NOTE: this file imports ONLY a TYPE from the pose package, so it has no native
 * runtime dependency itself — the native imports live in CameraVerifierView.
 */

/** Module-level sink: the active (started) backend's frame callback, if any. */
let activeSink: ((raw: RawPoseFrame) => void) | null = null;

/** Push a raw frame into the active verifier (no-op when no drill is sampling). */
export function feedRawFrame(raw: RawPoseFrame): void {
  activeSink?.(raw);
}

/**
 * Convert a MediaPipe LIVE_STREAM result bundle into a RawPoseFrame.
 *
 * Clock: the library exposes NO frame/capture timestamp in the JS result — only
 * `inferenceTime`. We approximate the capture instant as `Date.now() − inferenceTime`
 * (removes the variable inference duration, the largest jitter source) on the
 * wall-clock epoch axis — the SAME axis the engine's drill clock uses (t0 is
 * Date.now()). It is a calibratable bias, not skew (see the perception-architecture
 * doc §2/§3, "calibrate a fixed pipeline-delay offset"). Returns null when no pose.
 *
 * `modelId` stamps WHICH pose variant produced the frame, so a capture is attributable to its
 * model arm — the precondition for a scoreable lite-vs-full benchmark. It is a required
 * argument on purpose: an implicit default is exactly how a benchmark ends up with two arms
 * that claim the same provenance. The caller (CameraVerifierView) owns the active variant.
 */
export function toRawPoseFrame(
  bundle: PoseDetectionResultBundle,
  modelId: string,
): RawPoseFrame | null {
  const result = bundle.results?.[0];
  const world = result?.worldLandmarks?.[0];
  if (!world || world.length === 0) return null;
  const image = result?.landmarks?.[0] ?? world;

  const captureClockMs = Date.now() - (bundle.inferenceTime ?? 0);
  const worldOut: Landmark3D[] = world.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }));
  const landmarks: Landmark[] = image.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }));
  // Visibility is the load-bearing confidence signal. MediaPipe Pose carries it
  // on the IMAGE (NormalizedLandmark) list — the WORLD Landmark list often omits
  // it, which would zero out every sample (dropping all scans + breaking
  // calibration). Source from image; fall back to world only if image is absent.
  const visSource = image.length === world.length ? image : world;
  const visibility = visSource.map((l) => l.visibility ?? 0);

  return {
    captureClockMs,
    landmarks,
    world: worldOut,
    visibility,
    modelId,
    inferenceMs: bundle.inferenceTime,
  };
}

export class MediaPipeBackend implements PerceptionBackend {
  readonly id = 'mediapipe';
  readonly version: string;

  private cb: ((raw: RawPoseFrame) => void) | null = null;

  /**
   * The model spec is INJECTED once per run (by the registry, from the active selection)
   * rather than read per frame, so a variant switched mid-run cannot split one capture across
   * two engine labels. `version` flows into `ScanVerification.engine` (e.g.
   * "mediapipe@pose-full-0.4.0") and thus into the capture bundle, which is how a benchmark
   * trace knows which arm produced it.
   */
  constructor(model: PoseModelSpec = DEFAULT_POSE_MODEL_SPEC) {
    this.version = model.version;
  }

  /**
   * Reached only via the registry's dynamic import in a dev build with
   * VISION_ENABLED set, so the native pose/camera modules are linked. The real
   * camera + permission lifecycle is owned by CameraVerifierView (and gated by
   * the framing screen); if no frames arrive the run simply yields 0 scans.
   */
  async available(): Promise<boolean> {
    return true;
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
