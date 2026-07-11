/**
 * Pure rollups over stored session summaries for the Stats tab.
 * Verification metrics stay null until Phase 2 fills CueEvent.verification.
 */

import type { CueDistributionRow } from '@/components/drill/sessionStats';
import type { DrillMode } from '@/types';
import type { StoredSessionSummary } from '@/services/db';

export interface HistoryRollup {
  sessionCount: number;
  totalDurationMs: number;
  totalCues: number;
  audioSessions: number;
  turnReactSessions: number;
  /** Aggregated cue mix across all sessions. */
  cueMix: CueDistributionRow[];
  leftChecks: number;
  rightChecks: number;
  /**
   * Null-honest Phase 2 placeholders. Never zero-fill — audio and preview
   * runs have no verification evidence.
   */
  scannedBeforeActionRate: number | null;
  meanReactionMs: number | null;
  anticipationRate: number | null;
}

export function rollupSessions(
  sessions: readonly StoredSessionSummary[],
): HistoryRollup {
  const mix = new Map<string, CueDistributionRow>();
  let totalDurationMs = 0;
  let totalCues = 0;
  let audioSessions = 0;
  let turnReactSessions = 0;
  let leftChecks = 0;
  let rightChecks = 0;

  for (const s of sessions) {
    totalDurationMs += s.durationDrillMs;
    totalCues += s.cueCount;
    if (s.mode === 'turn-react') turnReactSessions += 1;
    else audioSessions += 1;

    for (const row of s.distribution) {
      const prev = mix.get(row.cueId);
      if (prev) prev.count += row.count;
      else mix.set(row.cueId, { ...row });
      if (row.cueId === 'check_left') leftChecks += row.count;
      if (row.cueId === 'check_right') rightChecks += row.count;
    }
  }

  const cueMix = [...mix.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  return {
    sessionCount: sessions.length,
    totalDurationMs,
    totalCues,
    audioSessions,
    turnReactSessions,
    cueMix,
    leftChecks,
    rightChecks,
    scannedBeforeActionRate: null,
    meanReactionMs: null,
    anticipationRate: null,
  };
}

export function modeLabel(mode: DrillMode): string {
  return mode === 'turn-react' ? 'Turn & React' : 'Audio';
}
