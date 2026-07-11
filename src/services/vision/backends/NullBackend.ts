import type {
  BackendStartConfig,
  PerceptionBackend,
  RawPoseFrame,
} from '../PerceptionBackend';

/**
 * No-op perception backend for Expo Go / audio-only: reports unavailable and
 * never emits frames. Zero native code.
 */
export class NullBackend implements PerceptionBackend {
  readonly id = 'null';
  readonly version = '0';

  async available(): Promise<boolean> {
    return false;
  }

  start(_cfg?: BackendStartConfig): void {
    /* no-op */
  }

  onRawPose(_cb: (raw: RawPoseFrame) => void): void {
    /* no-op */
  }

  stop(): void {
    /* no-op */
  }
}
