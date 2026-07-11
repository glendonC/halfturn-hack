import { getDatabase } from './database';
import {
  cueEventsToRows,
  rowToSummary,
  rowsToDetail,
  sessionToRow,
} from './mappers';
import type {
  CueEventRow,
  SaveSessionInput,
  SessionRow,
  StoredSessionDetail,
  StoredSessionSummary,
} from './types';

export async function saveSession(input: SaveSessionInput): Promise<void> {
  const db = await getDatabase();
  const session = sessionToRow(input);
  const cues = cueEventsToRows(input.id, input.cues);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO sessions (
        id, started_at_wall_ms, ended_at_wall_ms, duration_drill_ms, mode,
        config_json, cue_count, distribution_json, verification_json,
        synced_at, server_id, dirty, deleted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.started_at_wall_ms,
      session.ended_at_wall_ms,
      session.duration_drill_ms,
      session.mode,
      session.config_json,
      session.cue_count,
      session.distribution_json,
      session.verification_json,
      session.synced_at,
      session.server_id,
      session.dirty,
      session.deleted_at,
      session.created_at,
    );

    await db.runAsync(`DELETE FROM cue_events WHERE session_id = ?`, input.id);

    for (const cue of cues) {
      await db.runAsync(
        `INSERT INTO cue_events (
          id, session_id, cue_id, cue_label, sequence_index,
          onset_wall_ms, onset_drill_ms, verification_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        cue.id,
        cue.session_id,
        cue.cue_id,
        cue.cue_label,
        cue.sequence_index,
        cue.onset_wall_ms,
        cue.onset_drill_ms,
        cue.verification_json,
      );
    }
  });
}

export async function listSessions(
  limit = 50,
): Promise<StoredSessionSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions
     WHERE deleted_at IS NULL
     ORDER BY started_at_wall_ms DESC
     LIMIT ?`,
    limit,
  );
  return rows.map(rowToSummary);
}

export async function getSession(
  id: string,
): Promise<StoredSessionDetail | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  if (!row) return null;

  const cues = await db.getAllAsync<CueEventRow>(
    `SELECT * FROM cue_events WHERE session_id = ? ORDER BY sequence_index ASC`,
    id,
  );
  return rowsToDetail(row, cues);
}

export async function softDeleteSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET deleted_at = ?, dirty = 1 WHERE id = ?`,
    Date.now(),
    id,
  );
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE sessions SET deleted_at = ?, dirty = 1 WHERE deleted_at IS NULL`,
    now,
  );
}
