import type { DrillClocks, DrillMs, WallMs } from '@/types';

export type WallNowFn = () => WallMs;

/**
 * Dual clocks: wall is absolute; drill is monotonic and freezes while paused.
 * Pure enough to unit-test with an injected wallNow.
 */
export class PausableDrillClocks implements DrillClocks {
  private accumulatedDrillMs: DrillMs = 0;
  private runningSinceWallMs: WallMs | null = null;
  private readonly wallNowFn: WallNowFn;

  constructor(wallNowFn: WallNowFn = () => Date.now()) {
    this.wallNowFn = wallNowFn;
  }

  wallNow(): WallMs {
    return this.wallNowFn();
  }

  drillNow(atWallMs?: WallMs): DrillMs {
    const wall = atWallMs ?? this.wallNowFn();
    if (this.runningSinceWallMs == null) {
      return this.accumulatedDrillMs;
    }
    return this.accumulatedDrillMs + (wall - this.runningSinceWallMs);
  }

  /** Start (or restart) drill time from zero, running. */
  start(atWallMs?: WallMs): void {
    const wall = atWallMs ?? this.wallNowFn();
    this.accumulatedDrillMs = 0;
    this.runningSinceWallMs = wall;
  }

  pause(atWallMs?: WallMs): void {
    const wall = atWallMs ?? this.wallNowFn();
    if (this.runningSinceWallMs == null) return;
    this.accumulatedDrillMs += wall - this.runningSinceWallMs;
    this.runningSinceWallMs = null;
  }

  resume(atWallMs?: WallMs): void {
    const wall = atWallMs ?? this.wallNowFn();
    if (this.runningSinceWallMs != null) return;
    this.runningSinceWallMs = wall;
  }

  isRunning(): boolean {
    return this.runningSinceWallMs != null;
  }

  /** Snapshot accumulated drill ms without advancing (useful after pause). */
  getAccumulatedDrillMs(): DrillMs {
    return this.accumulatedDrillMs;
  }
}
