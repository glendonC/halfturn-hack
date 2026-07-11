import type { BackendStartConfig, PerceptionBackend, RawPoseFrame } from '../PerceptionBackend';

/**
 * Test-only synchronous PerceptionBackend: replays a frozen RawPoseFrame[] into the
 * REAL RealPoseVerifier so the golden gate exercises the actual first-frame clock-offset
 * anchoring in handleFrame — not a re-implemented copy of that math. Because `start()`
 * drains every frame synchronously in one loop, this gate CANNOT interleave a
 * pause()/resume(), so the pause/resume re-anchor branch is NOT covered here — that path
 * is covered separately by RealPoseVerifier.test.ts (a manually-driven backend).
 * RealPoseVerifier subscribes via onRawPose before calling start, so the whole replay
 * completes inside `verifier.start()` with no timers. Not a `*.test.ts` file, so jest
 * never runs it as a suite.
 */
export class FakeSyncBackend implements PerceptionBackend {
  readonly id = 'fake';
  readonly version = 'test-1';
  private cb: ((raw: RawPoseFrame) => void) | null = null;

  constructor(private readonly frames: RawPoseFrame[]) {}

  async available(): Promise<boolean> {
    return true;
  }

  onRawPose(cb: (raw: RawPoseFrame) => void): void {
    this.cb = cb;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start(_cfg?: BackendStartConfig): void {
    for (const f of this.frames) this.cb?.(f);
  }

  stop(): void {
    this.cb = null;
  }
}
