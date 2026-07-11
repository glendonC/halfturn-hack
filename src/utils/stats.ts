/**
 * Aggregate derivations over saved sessions. Pure functions only — they read the
 * same summary rows the History/Stats screens already load, so the Stats tab can
 * show trends and totals without any new database query.
 */

import type { CueType } from '@/types';
import type { StoredSessionSummary } from '@/services/db';

export type CueCounts = Partial<Record<CueType, number>>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session counts bucketed by week, oldest → newest, for the last `weeks` weeks
 * ending now. The final bucket is the current (rolling) week, so it drives the
 * sparkline's trailing point.
 */
export function weeklySessionCounts(
  sessions: StoredSessionSummary[],
  weeks: number,
  now: number = Date.now(),
): number[] {
  const buckets = new Array<number>(weeks).fill(0);
  const start = now - weeks * WEEK_MS;
  for (const s of sessions) {
    if (s.startedAtWallMs < start) continue;
    const idx = Math.floor((s.startedAtWallMs - start) / WEEK_MS);
    if (idx >= 0 && idx < weeks) buckets[idx] += 1;
  }
  return buckets;
}

/** Sum cue counts across every session into one aggregate mix. */
export function aggregateCueCounts(
  sessions: StoredSessionSummary[],
): CueCounts {
  const total: CueCounts = {};
  for (const s of sessions) {
    for (const row of s.distribution) {
      total[row.cueId] = (total[row.cueId] ?? 0) + row.count;
    }
  }
  return total;
}

/** Left vs right shoulder-check totals (the only directional cues). */
export function leftRightSplit(counts: CueCounts): {
  left: number;
  right: number;
} {
  return { left: counts.check_left ?? 0, right: counts.check_right ?? 0 };
}
