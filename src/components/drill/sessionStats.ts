import { getCueDefinition } from '@/constants';
import type { CueEvent, CueType } from '@/types';

export interface CueDistributionRow {
  cueId: CueType;
  label: string;
  count: number;
}

export function summarizeCueDistribution(
  events: readonly CueEvent[],
): CueDistributionRow[] {
  const counts = new Map<CueType, number>();
  for (const event of events) {
    counts.set(event.cueId, (counts.get(event.cueId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cueId, count]) => ({
      cueId,
      label: getCueDefinition(cueId).hudLabel,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
