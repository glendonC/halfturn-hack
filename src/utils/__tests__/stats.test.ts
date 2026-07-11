import {
  aggregateCueCounts,
  leftRightSplit,
  weeklySessionCounts,
} from '../stats';
import type { StoredSessionSummary } from '@/services/db';
import { createDefaultDrillConfig } from '@/constants';

function session(
  partial: Partial<StoredSessionSummary> &
    Pick<StoredSessionSummary, 'id' | 'startedAtWallMs'>,
): StoredSessionSummary {
  return {
    endedAtWallMs: partial.startedAtWallMs + 60_000,
    durationDrillMs: 60_000,
    mode: 'audio',
    cueCount: 0,
    distribution: [],
    config: createDefaultDrillConfig(),
    completed: true,
    schemaVersion: 1,
    ...partial,
  };
}

describe('weeklySessionCounts', () => {
  const now = 1_700_000_000_000;

  it('buckets sessions into the last N weeks oldest→newest', () => {
    const weeks = 4;
    const list = [
      session({ id: 'a', startedAtWallMs: now - 3.5 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'b', startedAtWallMs: now - 0.5 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'c', startedAtWallMs: now - 0.1 * 7 * 24 * 60 * 60 * 1000 }),
      session({ id: 'old', startedAtWallMs: now - 10 * 7 * 24 * 60 * 60 * 1000 }),
    ];
    const buckets = weeklySessionCounts(list, weeks, now);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(3);
    expect(buckets[3]).toBe(2); // current week
  });
});

describe('aggregateCueCounts + leftRightSplit', () => {
  it('sums distribution rows and splits left/right checks', () => {
    const list = [
      session({
        id: '1',
        startedAtWallMs: 1,
        distribution: [
          { cueId: 'check_left', label: 'LEFT', count: 3 },
          { cueId: 'check_right', label: 'RIGHT', count: 1 },
          { cueId: 'turn', label: 'TURN', count: 2 },
        ],
      }),
      session({
        id: '2',
        startedAtWallMs: 2,
        distribution: [
          { cueId: 'check_left', label: 'LEFT', count: 1 },
          { cueId: 'scan', label: 'SCAN', count: 4 },
        ],
      }),
    ];
    const mix = aggregateCueCounts(list);
    expect(mix.check_left).toBe(4);
    expect(mix.check_right).toBe(1);
    expect(mix.turn).toBe(2);
    expect(mix.scan).toBe(4);
    expect(leftRightSplit(mix)).toEqual({ left: 4, right: 1 });
  });
});
