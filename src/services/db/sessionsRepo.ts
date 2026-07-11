/**
 * Production-named session persistence facade.
 * Backed by hack sessionRepository + historyStats until schemas fully converge.
 */

import { rollupSessions } from './historyStats';
import { listSessions } from './sessionRepository';

export {
  saveSession,
  listSessions,
  getSession,
  clearAllSessions,
  deleteSession,
} from './sessionRepository';

export interface HistoryStats {
  totalSessions: number;
  totalCues: number;
  totalDurationSec: number;
  /** Sessions started within the last 7 days. */
  sessionsThisWeek: number;
}

/** Recent-history rollup using production HistoryStats field names. */
export async function getHistoryStats(): Promise<HistoryStats> {
  const sessions = await listSessions(500);
  const rollup = rollupSessions(sessions);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsThisWeek = sessions.filter(
    (s) => s.startedAtWallMs >= weekAgo,
  ).length;
  return {
    totalSessions: rollup.sessionCount,
    totalCues: rollup.totalCues,
    totalDurationSec: Math.round(rollup.totalDurationMs / 1000),
    sessionsThisWeek,
  };
}
