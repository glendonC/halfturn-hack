import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'halfturn.db';

/** Version envelope for the per-session config snapshot (see sessionsRepo). */
export const CONFIG_SNAPSHOT_VERSION = 1;

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Forward-only migration ladder. Index i upgrades to user_version = i + 1.
 * Never edit a shipped migration. Append a new one.
 */
const MIGRATIONS: Array<(db: SQLiteDatabase) => Promise<void>> = [
  // ---- v1: initial schema ----
  async (db) => {
    await db.execAsync(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at_wall_ms INTEGER NOT NULL,
  ended_at_wall_ms INTEGER,
  duration_drill_ms INTEGER NOT NULL,
  mode TEXT NOT NULL,
  config_json TEXT NOT NULL,
  cue_count INTEGER NOT NULL,
  distribution_json TEXT NOT NULL,
  verification_json TEXT,
  synced_at INTEGER,
  server_id TEXT,
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cue_events (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  cue_id TEXT NOT NULL,
  cue_label TEXT NOT NULL,
  sequence_index INTEGER NOT NULL,
  onset_wall_ms INTEGER NOT NULL,
  onset_drill_ms INTEGER NOT NULL,
  verification_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_started
  ON sessions(started_at_wall_ms DESC);

CREATE INDEX IF NOT EXISTS idx_cue_events_session
  ON cue_events(session_id, sequence_index);

CREATE TABLE IF NOT EXISTS settings_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL
);
`);
  },
  // ---- v2: planned_offset_ms on cue_events ----
  async (db) => {
    await db.execAsync(`
ALTER TABLE cue_events ADD COLUMN planned_offset_ms INTEGER NOT NULL DEFAULT 0;
`);
  },
  // ---- v3: category/side on cues; completed + schema_version on sessions ----
  async (db) => {
    await db.execAsync(`
ALTER TABLE cue_events ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE cue_events ADD COLUMN side TEXT NOT NULL DEFAULT 'none';
ALTER TABLE sessions ADD COLUMN completed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
`);
  },
  // ---- v4: canonical drill_sessions + cue timeline ----
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

DROP TABLE IF EXISTS cue_events;

CREATE TABLE cue_events (
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

CREATE INDEX IF NOT EXISTS idx_drill_sessions_started ON drill_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cue_events_session ON cue_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cue_events_session_mono ON cue_events(session_id, fired_at_mono_ms);
`);
  },
];

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[i](db);
    });
    version = i + 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Test seam: drop the cached open so the next getDatabase() re-migrates. */
export function __resetDatabasePromiseForTests(): void {
  dbPromise = null;
}

/** Call once during app startup to eagerly open + migrate the DB. */
export async function initDatabase(): Promise<void> {
  await getDatabase();
}
