import * as SQLite from 'expo-sqlite';

const DB_NAME = 'halfturn.db';

/** Version envelope for the per-session config snapshot (see sessionsRepo). */
export const CONFIG_SNAPSHOT_VERSION = 1;

/**
 * Forward-only migration ladder. Each entry upgrades the DB by exactly one
 * version; `migrate()` runs every entry whose index is >= the stored
 * PRAGMA user_version. Never edit a shipped migration — append a new one.
 *
 * Design notes (from the architecture review):
 * - `cue_events` exists from v1 (written now, read by camera verification) so
 *   reaction-time becomes a per-event join — no future rewrite/backfill.
 * - Each cue event stores BOTH wall-clock (epoch) and drill-monotonic ms.
 * - String (ULID-ish) primary keys + nullable sync columns make a future
 *   Supabase/Convex sync a purely additive feature.
 */
const MIGRATIONS: Array<(db: SQLite.SQLiteDatabase) => Promise<void>> = [
  // ---- v1: initial schema ----
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS drill_sessions (
        id                   TEXT PRIMARY KEY NOT NULL,
        started_at           INTEGER NOT NULL,
        ended_at             INTEGER NOT NULL,
        planned_duration_sec INTEGER NOT NULL,
        actual_duration_sec  INTEGER NOT NULL,
        config_json          TEXT NOT NULL,
        cue_counts_json      TEXT NOT NULL,
        total_cues           INTEGER NOT NULL,
        completed            INTEGER NOT NULL,
        schema_version       INTEGER NOT NULL,
        verification_json    TEXT,
        synced_at            INTEGER,
        server_id            TEXT,
        dirty                INTEGER NOT NULL DEFAULT 1,
        deleted_at           INTEGER
      );

      CREATE TABLE IF NOT EXISTS cue_events (
        id                TEXT PRIMARY KEY NOT NULL,
        session_id        TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
        seq               INTEGER NOT NULL,
        cue_id            TEXT NOT NULL,
        category          TEXT NOT NULL,
        side              TEXT NOT NULL,
        spoken_text       TEXT NOT NULL,
        fired_at_epoch_ms INTEGER NOT NULL,
        fired_at_mono_ms  INTEGER NOT NULL,
        planned_offset_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_started ON drill_sessions(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cue_events_session ON cue_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_cue_events_session_mono ON cue_events(session_id, fired_at_mono_ms);
    `);
  },
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[i](db);
    });
    version = i + 1;
  }
  // PRAGMA can't be parameterized; version is our own trusted integer.
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Open (once) the history DB with WAL + foreign keys, running migrations. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      // foreign_keys must be enabled per-connection for ON DELETE CASCADE to fire.
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Call once during app startup to eagerly open + migrate the DB. */
export async function initDatabase(): Promise<void> {
  await getDatabase();
}
