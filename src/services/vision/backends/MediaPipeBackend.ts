import type {
  BackendStartConfig,
  PerceptionBackend,
  RawPoseFrame,
} from '../PerceptionBackend';
import { canUseNativeVision } from '../runtimeGuard';

/**
 * MediaPipe pose backend bridge (dev-client path).
 *
 * No native package imports in this file — CameraVerifierView (once linked)
 * calls feedRawFrame(); this backend forwards to the active RealPoseVerifier.
 * available() is true only when canUseNativeVision() so Expo Go never selects it.
 */

let activeSink: ((raw: RawPoseFrame) => void) | null = null;

/** Push a raw frame into the active verifier (no-op when none is sampling). */
export function feedRawFrame(raw: RawPoseFrame): void {
  activeSink?.(raw);
}

export class MediaPipeBackend implements PerceptionBackend {
  readonly id = 'mediapipe';
  readonly version = 'pose-lite-bridge';
  private cb: ((raw: RawPoseFrame) => void) | null = null;

  async available(): Promise<boolean> {
    return canUseNativeVision();
  }

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
