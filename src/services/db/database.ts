import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'halfturn.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

const MIGRATIONS = `
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
`;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await db.execAsync(MIGRATIONS);
      return db;
    })();
  }
  return dbPromise;
}

/** Test seam */
export function __resetDatabasePromiseForTests(): void {
  dbPromise = null;
}
