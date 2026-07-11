/**
 * Aggregate derivations over saved sessions. Pure functions only — they read the
 * same `DrillSessionSummary` rows the History/Stats screens already load, so the
 * Stats tab can show trends and totals without any new database query.
 */

import type { CueCounts, CueId, DrillSessionSummary } from '@/types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session counts bucketed by week, oldest → newest, for the last `weeks` weeks
 * ending now. The final bucket is the current (rolling) week, so it drives the
 * sparkline's trailing point.
 */
export function weeklySessionCounts(
  sessions: DrillSessionSummary[],
  weeks: number,
  now: number = Date.now(),
): number[] {
  const buckets = new Array<number>(weeks).fill(0);
  const start = now - weeks * WEEK_MS;
  for (const s of sessions) {
    if (s.startedAt < start) continue;
    const idx = Math.floor((s.startedAt - start) / WEEK_MS);
    if (idx >= 0 && idx < weeks) buckets[idx] += 1;
  }
  return buckets;
}

/** Sum cue counts across every session into one aggregate mix. */
export function aggregateCueCounts(sessions: DrillSessionSummary[]): CueCounts {
  const total: CueCounts = {};
  for (const s of sessions) {
    for (const [id, n] of Object.entries(s.cueCounts)) {
      total[id as CueId] = (total[id as CueId] ?? 0) + (n ?? 0);
    }
  }
  return total;
}

/** Left vs right shoulder-check totals (the only directional cues). */
export function leftRightSplit(counts: CueCounts): { left: number; right: number } {
  return { left: counts.check_left ?? 0, right: counts.check_right ?? 0 };
}
