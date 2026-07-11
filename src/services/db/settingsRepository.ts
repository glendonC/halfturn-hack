import { getDatabase } from './database';
import {
  createDefaultAppSettings,
  parseAppSettings,
  serializeAppSettings,
  SETTINGS_KEY,
} from './mappers';
import type { AppSettings } from './types';

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value_json: string }>(
    `SELECT value_json FROM settings_kv WHERE key = ?`,
    SETTINGS_KEY,
  );
  return parseAppSettings(row?.value_json);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings_kv (key, value_json) VALUES (?, ?)`,
    SETTINGS_KEY,
    serializeAppSettings(settings),
  );
}

export async function resetSettings(): Promise<AppSettings> {
  const defaults = createDefaultAppSettings();
  await saveSettings(defaults);
  return defaults;
}
