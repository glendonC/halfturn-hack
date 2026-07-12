import type {
  CueCounts,
  CueEvent,
  CueId,
  DrillConfig,
  DrillSession,
  DrillSessionSummary,
  ScanVerification,
} from '@/types';
import { generateId } from '@/utils/id';
import { CONFIG_SNAPSHOT_VERSION, getDatabase } from './database';

interface SessionRow {
  id: string;
  started_at: number;
  ended_at: number;
  planned_duration_sec: number;
  actual_duration_sec: number;
  config_json: string;
  cue_counts_json: string;
  total_cues: number;
  completed: number;
  schema_version: number;
  verification_json: string | null;
}

interface CueEventRow {
  seq: number;
  cue_id: string;
  category: string;
  side: string;
  spoken_text: string;
  fired_at_epoch_ms: number;
  fired_at_mono_ms: number;
  planned_offset_ms: number;
}

export interface HistoryStats {
  totalSessions: number;
  totalCues: number;
  totalDurationSec: number;
  /** Sessions started within the last 7 days. */
  sessionsThisWeek: number;
}

function deriveCueCounts(events: CueEvent[]): CueCounts {
  const counts: CueCounts = {};
  for (const e of events) {
    counts[e.cueId] = (counts[e.cueId] ?? 0) + 1;
  }
  return counts;
}

function parseConfigEnvelope(json: string): DrillConfig {
  const parsed = JSON.parse(json) as { v?: number; config: DrillConfig } | DrillConfig;
  // Tolerate both the versioned envelope and a bare config (defensive).
  return 'config' in parsed ? parsed.config : (parsed as DrillConfig);
}

function rowToSummary(row: SessionRow): DrillSessionSummary {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    plannedDurationSec: row.planned_duration_sec,
    actualDurationSec: row.actual_duration_sec,
    config: parseConfigEnvelope(row.config_json),
    cueCounts: JSON.parse(row.cue_counts_json) as CueCounts,
    totalCues: row.total_cues,
    completed: row.completed === 1,
    schemaVersion: row.schema_version,
    verification: row.verification_json
      ? (JSON.parse(row.verification_json) as ScanVerification)
      : null,
  };
}

/** Persist a finished session + its full cue timeline atomically. */
export async function saveSession(session: DrillSession): Promise<void> {
  const db = await getDatabase();
  // Derive aggregates from events so the denormalized columns can't drift.
  const cueCounts = deriveCueCounts(session.events);
  const totalCues = session.events.length;
  const configEnvelope = JSON.stringify({ v: CONFIG_SNAPSHOT_VERSION, config: session.config });

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO drill_sessions
        (id, started_at, ended_at, planned_duration_sec, actual_duration_sec,
         config_json, cue_counts_json, total_cues, completed, schema_version,
         verification_json, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      session.id,
      session.startedAt,
      session.endedAt,
      session.plannedDurationSec,
      session.actualDurationSec,
      configEnvelope,
      JSON.stringify(cueCounts),
      totalCues,
      session.completed ? 1 : 0,
      session.schemaVersion,
      session.verification ? JSON.stringify(session.verification) : null,
    );

    for (const e of session.events) {
      await db.runAsync(
        `INSERT INTO cue_events
          (id, session_id, seq, cue_id, category, side, spoken_text,
           fired_at_epoch_ms, fired_at_mono_ms, planned_offset_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        generateId('cue'),
        session.id,
        e.seq,
        e.cueId,
        e.category,
        e.side,
        e.phrase,
        e.firedAtEpochMs,
        e.firedAtMonoMs,
        e.plannedOffsetMs,
      );
    }
  });
}

/** Recent sessions (newest first), without their cue-event payloads. */
export async function listSessions(limit = 100): Promise<DrillSessionSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM drill_sessions
     WHERE deleted_at IS NULL
     ORDER BY started_at DESC
     LIMIT ?`,
    limit,
  );
  return rows.map(rowToSummary);
}

/** A single session including its full cue timeline. */
export async function getSession(id: string): Promise<DrillSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM drill_sessions WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  if (!row) return null;

  const eventRows = await db.getAllAsync<CueEventRow>(
    `SELECT seq, cue_id, category, side, spoken_text,
            fired_at_epoch_ms, fired_at_mono_ms, planned_offset_ms
     FROM cue_events WHERE session_id = ? ORDER BY seq ASC`,
    id,
  );

  const events: CueEvent[] = eventRows.map((e) => ({
    seq: e.seq,
    cueId: e.cue_id as CueId,
    category: e.category as CueEvent['category'],
    side: e.side as CueEvent['side'],
    phrase: e.spoken_text,
    firedAtEpochMs: e.fired_at_epoch_ms,
    firedAtMonoMs: e.fired_at_mono_ms,
    plannedOffsetMs: e.planned_offset_ms,
  }));

  return { ...rowToSummary(row), events };
}

/** Hard-delete a session (cue_events cascade). */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM drill_sessions WHERE id = ?', id);
}

/** Hard-delete many sessions in one transaction (cue_events cascade). */
export async function deleteSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (ids.length === 1) {
    await deleteSession(ids[0]!);
    return;
  }
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM drill_sessions WHERE id = ?', id);
    }
  });
}

/** Wipe all history (used by Profile / History → "Clear history"). */
export async function clearAllSessions(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM cue_events; DELETE FROM drill_sessions;');
}

export async function getHistoryStats(): Promise<HistoryStats> {
  const db = await getDatabase();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const row = await db.getFirstAsync<{
    total_sessions: number;
    total_cues: number;
    total_duration: number;
    week_sessions: number;
  }>(
    `SELECT
       COUNT(*)                                      AS total_sessions,
       COALESCE(SUM(total_cues), 0)                  AS total_cues,
       COALESCE(SUM(actual_duration_sec), 0)         AS total_duration,
       COALESCE(SUM(started_at >= ?), 0)             AS week_sessions
     FROM drill_sessions WHERE deleted_at IS NULL`,
    weekAgo,
  );
  return {
    totalSessions: row?.total_sessions ?? 0,
    totalCues: row?.total_cues ?? 0,
    totalDurationSec: row?.total_duration ?? 0,
    sessionsThisWeek: row?.week_sessions ?? 0,
  };
}
