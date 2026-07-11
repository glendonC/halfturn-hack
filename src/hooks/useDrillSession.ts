import { useDrillStore } from '@/state';
import { formatClock } from '@/utils/format';
import type { DrillStatus } from '@/types';

/**
 * Clock selectors for HUD chrome. The active screen should drive the run via
 * useDrillEngine; this hook only reads store mirrors.
 */
export function useDrillClock(): {
  status: DrillStatus;
  timeRemainingMs: number;
  timeRemainingLabel: string;
  cueLabel: string | null;
  cuesFired: number;
} {
  const status = useDrillStore((s) => s.status);
  const timeRemainingMs = useDrillStore((s) => s.remainingMs);
  const cuesFired = useDrillStore((s) => s.events.length);
  const cueLabel = useDrillStore((s) => s.currentCue?.phrase ?? null);

  return {
    status,
    timeRemainingMs,
    timeRemainingLabel: formatClock(timeRemainingMs / 1000),
    cueLabel,
    cuesFired,
  };
}
