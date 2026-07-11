import type { DrillSessionSummary } from '@/types';
import { createDefaultDrillConfig } from '@/constants';
import {
  aggregateCueCounts,
  leftRightSplit,
  weeklySessionCounts,
} from '../stats';

function session(
  partial: Partial<DrillSessionSummary> &
    Pick<DrillSessionSummary, 'id' | 'startedAt'>,
): DrillSessionSummary {
  return {
    endedAt: partial.startedAt + 60_000,
    plannedDurationSec: 60,
    actualDurationSec: 60,
    totalCues: 10,
    cueCounts: { scan: 6, check_left: 4 },
    completed: true,
    schemaVersion: 1,
    verification: null,
    config: createDefaultDrillConfig(),
    ...partial,
  };
}

describe('weeklySessionCounts', () => {
  it('buckets sessions into recent weeks', () => {
    const now = 1_700_000_000_000;
    const list = [
      session({ id: 'a', startedAt: now - 3.5 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'b', startedAt: now - 0.5 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'c', startedAt: now - 0.1 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'old', startedAt: now - 10 * 7 * 24 * 60 * 60 * 1000 }),
    ];
    const weeks = weeklySessionCounts(list, 4, now);
    expect(weeks).toHaveLength(4);
    expect(weeks.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('aggregateCueCounts + leftRightSplit', () => {
  it('sums cue counts across sessions', () => {
    const list = [
      session({
        id: 'a',
        startedAt: 1,
        cueCounts: { scan: 2, check_left: 1 },
      }),
      session({
        id: 'b',
        startedAt: 2,
        cueCounts: { scan: 1, check_right: 3 },
      }),
    ];
    const mix = aggregateCueCounts(list);
    expect(mix.scan).toBe(3);
    expect(leftRightSplit(mix)).toEqual({ left: 1, right: 3 });
  });
});
