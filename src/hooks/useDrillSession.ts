import {
  formatRemainingClock,
  selectCurrentCueLabel,
  useDrillStore,
  type DrillStatus,
} from '@/state';

/**
 * Clock selectors for HUD chrome. The active screen should drive the run via
 * {@link useDrillEngine}; this hook only reads store mirrors.
 */
export function useDrillClock(): {
  status: DrillStatus;
  timeRemainingMs: number;
  timeRemainingLabel: string;
  countdownRemainingSec: number;
  cueLabel: string | null;
  cuesFired: number;
} {
  const status = useDrillStore((s) => s.status);
  const timeRemainingMs = useDrillStore((s) => s.timeRemainingMs);
  const countdownRemainingSec = useDrillStore((s) => s.countdownRemainingSec);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const cueLabel = useDrillStore(selectCurrentCueLabel);

  return {
    status,
    timeRemainingMs,
    timeRemainingLabel: formatRemainingClock(timeRemainingMs),
    countdownRemainingSec,
    cueLabel,
    cuesFired,
  };
}
