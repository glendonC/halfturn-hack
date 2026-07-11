import type { AudioCueEngineOptions } from '@/services/audio';
import type {
  CueCategory,
  CueEvent,
  CueSide,
  CueType,
  DrillConfig,
  DrillMode,
} from '@/types';

import type { CueDistributionRow } from '@/components/drill/sessionStats';

/** Version envelope for the per-session config snapshot. */
export const CONFIG_SNAPSHOT_VERSION = 1;

/** Session row schema version written into sessions.schema_version. */
export const DRILL_SESSION_SCHEMA_VERSION = 1;

/** Persisted app settings (single JSON blob in settings_kv). */
export interface AppSettings {
  version: 1;
  audio: AudioCueEngineOptions;
  /** Defaults applied to new drills / Train setup */
  drill: DrillConfig;
  /** When false, skip activateKeepAwake during countdown/running */
  keepAwakeDefault: boolean;
}

export interface SessionRow {
  id: string;
  started_at_wall_ms: number;
  ended_at_wall_ms: number | null;
  duration_drill_ms: number;
  mode: string;
  config_json: string;
  cue_count: number;
  distribution_json: string;
  verification_json: string | null;
  synced_at: number | null;
  server_id: string | null;
  dirty: number;
  deleted_at: number | null;
  created_at: number;
  /** 1 = ran to planned duration; 0 = stopped early. Old rows backfill as 1. */
  completed: number;
  schema_version: number;
}

export interface CueEventRow {
  id: string;
  session_id: string;
  cue_id: string;
  cue_label: string;
  sequence_index: number;
  onset_wall_ms: number;
  onset_drill_ms: number;
  planned_offset_ms: number;
  verification_json: string | null;
  category: string;
  side: string;
}

export interface StoredSessionSummary {
  id: string;
  startedAtWallMs: number;
  endedAtWallMs: number | null;
  durationDrillMs: number;
  mode: DrillMode;
  cueCount: number;
  distribution: CueDistributionRow[];
  config: DrillConfig;
  completed: boolean;
  schemaVersion: number;
}

export interface StoredSessionDetail extends StoredSessionSummary {
  cues: Array<{
    id: string;
    cueId: CueType;
    /** Resolved spoken phrase (cue_label column). */
    label: string;
    index: number;
    onsetWallMs: number;
    onsetDrillMs: number;
    plannedOffsetMs: number;
    category: CueCategory;
    side: CueSide;
  }>;
}

export interface SaveSessionInput {
  id: string;
  startedAtWallMs: number;
  endedAtWallMs: number;
  durationDrillMs: number;
  mode: DrillMode;
  config: DrillConfig;
  cues: CueEvent[];
  distribution: CueDistributionRow[];
  /** True when the drill ran to planned duration. */
  completed: boolean;
  schemaVersion?: number;
}
