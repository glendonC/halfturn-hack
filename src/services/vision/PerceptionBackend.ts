import type { ScanDetectConfig } from './types';

/**
 * The swappable-model boundary. A new CV "brain" (MediaPipe today, MoveNet /
 * ExecuTorch / a custom net / gaze tomorrow) is just a new `PerceptionBackend`
 * implementation — nothing above this line changes.
 *
 * Backends are the ONLY place native camera code may live; they are loaded
 * exclusively through a dynamic import in a dev build, never in the Expo Go
 * bundle.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface RawPoseFrame {
  /**
   * NATIVE capture-clock ms — the frame's exposure/presentation time, NOT
   * Date.now() at the JS callback (that would inject pipeline lag into
   * reaction time). YawFusion/the verifier normalize this onto the drill clock.
   */
  captureClockMs: number;
  /** Normalized image landmarks (0..1), MediaPipe BlazePose ordering. */
  landmarks: Landmark[];
  /** World landmarks in meters (hip-origin), when the backend provides them. */
  world?: Landmark3D[];
  /** Per-landmark visibility 0..1 (preferred over presence for occlusion). */
  visibility?: number[];
  /** Backend/model identity for provenance + A/B. */
  modelId: string;
  /** Measured inference time for this frame, if the backend reports it. */
  inferenceMs?: number;
}

export interface BackendStartConfig {
  /** Target frames/sec — raise from the ~15fps library default to 25–30. */
  fpsMode?: number;
  scanDetect?: ScanDetectConfig;
}

export interface PerceptionBackend {
  /** Stable id (`"mediapipe"`, `"movenet"`, `"null"`). */
  readonly id: string;
  /** Model/plugin version for provenance. */
  readonly version: string;
  /** Whether this backend can run in the current build/device. */
  available(): Promise<boolean>;
  start(cfg?: BackendStartConfig): void;
  /** Subscribe to raw pose frames (called on every processed frame). */
  onRawPose(cb: (raw: RawPoseFrame) => void): void;
  stop(): void;
}
