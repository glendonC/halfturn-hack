import type { UseDrillEngineResult } from '@/services/drill';

/**
 * Uniform prop contract every running-drill layout implements, so the active
 * screen can render whichever layout the run's mode maps to without knowing
 * which one it is.
 */
export interface DrillLayoutProps {
  engine: UseDrillEngineResult;
  durationMs: number;
  cueCount: number;
}
