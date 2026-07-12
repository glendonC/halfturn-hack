import type { BackendStartConfig, PerceptionBackend, RawPoseFrame } from '../PerceptionBackend';

/**
 * No-op perception backend used when no camera is wired / in Expo Go: it reports unavailable and
 * never emits frames, so a RealPoseVerifier built on it yields an empty scan
 * timeline and `DrillSession.verification` stays null. Zero native code.
 */
export class NullBackend implements PerceptionBackend {
  readonly id = 'null';
  readonly version = '0';

  async available(): Promise<boolean> {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start(_cfg?: BackendStartConfig): void {
    /* no-op */
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRawPose(_cb: (raw: RawPoseFrame) => void): void {
    /* no-op */
  }

  stop(): void {
    /* no-op */
  }
}
