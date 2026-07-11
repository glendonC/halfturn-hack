/**
 * Swappable perception-backend types (frame in → landmarks out).
 * Native implementations load only behind a later Expo Go / VISION_ENABLED guard.
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
   * Native capture-clock ms — frame exposure/presentation time, not Date.now()
   * at the JS callback. Verifiers normalize this onto the drill clock.
   */
  captureClockMs: number;
  /** Normalized image landmarks (0..1). */
  landmarks: Landmark[];
  /** World landmarks in meters when the backend provides them. */
  world?: Landmark3D[];
  /** Per-landmark visibility 0..1. */
  visibility?: number[];
  /** Backend/model identity for provenance. */
  modelId: string;
  inferenceMs?: number;
}

export interface BackendStartConfig {
  fpsMode?: number;
}

/**
 * Frame-level perception backend. The ONLY place native camera code may live.
 * Loaded through the registry (dynamic import in a later unlock); Expo Go gets NullBackend.
 */
export interface PerceptionBackend {
  readonly id: string;
  readonly version: string;
  available(): Promise<boolean>;
  start(cfg?: BackendStartConfig): void;
  onRawPose(cb: (raw: RawPoseFrame) => void): void;
  stop(): void;
}
