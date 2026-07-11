import { useEffect } from 'react';

import {
  formatRemainingClock,
  selectCurrentCueLabel,
  useDrillStore,
  type DrillStatus,
  type DrillStoreState,
} from '@/state';

const TICK_MS = 100;

/**
 * Binds the drill store to a wall-clock ticker while countdown/running.
 * Call from the active drill screen (or Train setup before navigate).
 */
export function useDrillSession(): DrillStoreState {
  const status = useDrillStore((s) => s.status);
  const tick = useDrillStore((s) => s.tick);

  useEffect(() => {
    if (status !== 'countdown' && status !== 'running') return;
    const id = setInterval(() => tick(), TICK_MS);
    return () => clearInterval(id);
  }, [status, tick]);

  return useDrillStore();
}

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
