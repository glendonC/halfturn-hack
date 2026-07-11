import { getCueDefinition } from '@/constants';
import { createDefaultDrillConfig } from '@/constants';
import {
  DEFAULT_AUDIO_OPTIONS,
  type AudioCueEngineOptions,
} from '@/services/audio/types';
import type {
  CueCategory,
  CueEvent,
  CueSide,
  CueType,
  DrillConfig,
  DrillMode,
} from '@/types';

import type { CueDistributionRow } from '@/components/drill/sessionStats';

import type {
  AppSettings,
  CueEventRow,
  SaveSessionInput,
  SessionRow,
  StoredSessionDetail,
  StoredSessionSummary,
} from './types';
import {
  CONFIG_SNAPSHOT_VERSION,
  DRILL_SESSION_SCHEMA_VERSION,
} from './types';

export {
  CONFIG_SNAPSHOT_VERSION,
  DRILL_SESSION_SCHEMA_VERSION,
} from './types';

export const SETTINGS_KEY = 'app.settings';

export function createDefaultAppSettings(): AppSettings {
  return {
    version: 1,
    audio: { ...DEFAULT_AUDIO_OPTIONS },
    drill: createDefaultDrillConfig(),
    keepAwakeDefault: true,
  };
}

export function serializeDistribution(
  rows: readonly CueDistributionRow[],
): string {
  return JSON.stringify(rows);
}

export function parseDistribution(json: string): CueDistributionRow[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (
          !row ||
          typeof row !== 'object' ||
          typeof (row as CueDistributionRow).cueId !== 'string' ||
          typeof (row as CueDistributionRow).count !== 'number'
        ) {
          return null;
        }
        const cueId = (row as CueDistributionRow).cueId as CueType;
        const label =
          typeof (row as CueDistributionRow).label === 'string'
            ? (row as CueDistributionRow).label
            : getCueDefinition(cueId)?.hudLabel ?? cueId;
        return {
          cueId,
          label,
          count: (row as CueDistributionRow).count,
        } satisfies CueDistributionRow;
      })
      .filter((r): r is CueDistributionRow => r != null);
  } catch {
    return [];
  }
}

/** Persist config inside a versioned envelope; readers tolerate bare configs. */
export function serializeConfig(config: DrillConfig): string {
  return JSON.stringify({ v: CONFIG_SNAPSHOT_VERSION, config });
}

export function parseConfig(json: string): DrillConfig {
  try {
    const raw = JSON.parse(json) as
      | { v?: number; config?: Partial<DrillConfig> }
      | Partial<DrillConfig>;
    if (
      raw &&
      typeof raw === 'object' &&
      'config' in raw &&
      raw.config &&
      typeof raw.config === 'object'
    ) {
      return createDefaultDrillConfig(raw.config);
    }
    return createDefaultDrillConfig(raw as Partial<DrillConfig>);
  } catch {
    return createDefaultDrillConfig();
  }
}

export function serializeAppSettings(settings: AppSettings): string {
  return JSON.stringify(settings);
}

export function parseAppSettings(json: string | null | undefined): AppSettings {
  const defaults = createDefaultAppSettings();
  if (!json) return defaults;
  try {
    const raw = JSON.parse(json) as Partial<AppSettings>;
    return {
      version: 1,
      audio: {
        ...defaults.audio,
        ...(raw.audio ?? {}),
      } satisfies AudioCueEngineOptions,
      drill: createDefaultDrillConfig(raw.drill ?? {}),
      keepAwakeDefault:
        typeof raw.keepAwakeDefault === 'boolean'
          ? raw.keepAwakeDefault
          : defaults.keepAwakeDefault,
    };
  } catch {
    return defaults;
  }
}

export function sessionToRow(
  input: SaveSessionInput,
  createdAt = Date.now(),
): SessionRow {
  return {
    id: input.id,
    started_at_wall_ms: input.startedAtWallMs,
    ended_at_wall_ms: input.endedAtWallMs,
    duration_drill_ms: input.durationDrillMs,
    mode: input.mode,
    config_json: serializeConfig(input.config),
    cue_count: input.cues.length,
    distribution_json: serializeDistribution(input.distribution),
    verification_json: input.verification
      ? JSON.stringify(input.verification)
      : null,
    synced_at: null,
    server_id: null,
    dirty: 0,
    deleted_at: null,
    created_at: createdAt,
    completed: input.completed ? 1 : 0,
    schema_version: input.schemaVersion ?? DRILL_SESSION_SCHEMA_VERSION,
  };
}

export function cueEventsToRows(
  sessionId: string,
  cues: readonly CueEvent[],
): CueEventRow[] {
  return cues.map((cue) => {
    const def = getCueDefinition(cue.cueId);
    return {
      id: cue.id,
      session_id: sessionId,
      cue_id: cue.cueId,
      cue_label: cue.phrase || def.hudLabel,
      sequence_index: cue.index,
      onset_wall_ms: cue.onsetWallMs,
      onset_drill_ms: cue.onsetDrillMs,
      planned_offset_ms: cue.plannedOffsetMs,
      verification_json: cue.verification
        ? JSON.stringify(cue.verification)
        : null,
      category: def.category,
      side: def.side,
    };
  });
}

function resolveCueCategory(cueId: CueType, stored: string): CueCategory {
  if (stored) return stored as CueCategory;
  return getCueDefinition(cueId).category;
}

function resolveCueSide(cueId: CueType, stored: string): CueSide {
  if (stored) return stored as CueSide;
  return getCueDefinition(cueId).side;
}

export function rowToSummary(row: SessionRow): StoredSessionSummary {
  return {
    id: row.id,
    startedAtWallMs: row.started_at_wall_ms,
    endedAtWallMs: row.ended_at_wall_ms,
    durationDrillMs: row.duration_drill_ms,
    mode: (row.mode as DrillMode) || 'audio',
    cueCount: row.cue_count,
    distribution: parseDistribution(row.distribution_json),
    config: parseConfig(row.config_json),
    // Old pre-v3 rows backfill completed=1 / schema_version=1 via migration defaults.
    completed: (row.completed ?? 1) === 1,
    schemaVersion: row.schema_version ?? DRILL_SESSION_SCHEMA_VERSION,
  };
}

export function rowsToDetail(
  row: SessionRow,
  cueRows: readonly CueEventRow[],
): StoredSessionDetail {
  return {
    ...rowToSummary(row),
    cues: [...cueRows]
      .sort((a, b) => a.sequence_index - b.sequence_index)
      .map((c) => {
        const cueId = c.cue_id as CueType;
        return {
          id: c.id,
          cueId,
          label: c.cue_label,
          index: c.sequence_index,
          onsetWallMs: c.onset_wall_ms,
          onsetDrillMs: c.onset_drill_ms,
          plannedOffsetMs: c.planned_offset_ms,
          category: resolveCueCategory(cueId, c.category ?? ''),
          side: resolveCueSide(cueId, c.side ?? ''),
        };
      }),
  };
}

export function formatSessionWhen(wallMs: number): string {
  const d = new Date(wallMs);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function shortDistributionLabel(
  distribution: readonly CueDistributionRow[],
  limit = 3,
): string {
  if (distribution.length === 0) return 'No cues';
  return distribution
    .slice(0, limit)
    .map((r) => `${r.label}×${r.count}`)
    .join(' · ');
}
