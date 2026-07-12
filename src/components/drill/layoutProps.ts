import type { UseDrillEngineResult } from '@/services/drill';

/**
 * The uniform prop contract every running-drill layout implements, so the active
 * screen can render whichever layout the run's mode maps to (see `DRILL_LAYOUTS`)
 * without knowing which one it is. `durationMs` is consumed by the audio HUD's
 * progress bar; the Turn & React layout derives its clock from `engine` alone but
 * still accepts it as part of the shared contract.
 */
export interface DrillLayoutProps {
  engine: UseDrillEngineResult;
  durationMs: number;
  cueCount: number;
}
