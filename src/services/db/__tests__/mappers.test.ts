import { createDefaultDrillConfig } from '@/constants';
import { DEFAULT_AUDIO_OPTIONS } from '@/services/audio/types';

import {
  CONFIG_SNAPSHOT_VERSION,
  DRILL_SESSION_SCHEMA_VERSION,
  createDefaultAppSettings,
  parseAppSettings,
  parseConfig,
  parseDistribution,
  serializeConfig,
  serializeDistribution,
  sessionToRow,
  shortDistributionLabel,
  cueEventsToRows,
  rowsToDetail,
} from '../mappers';
import type { CueEventRow, SaveSessionInput, SessionRow } from '../types';

describe('distribution serializers', () => {
  it('round-trips distribution rows', () => {
    const rows = [
      { cueId: 'scan' as const, label: 'SCAN', count: 3 },
      { cueId: 'turn' as const, label: 'TURN', count: 1 },
    ];
    expect(parseDistribution(serializeDistribution(rows))).toEqual(rows);
  });

  it('returns empty array on bad JSON', () => {
    expect(parseDistribution('nope')).toEqual([]);
    expect(parseDistribution('{}')).toEqual([]);
  });

  it('builds a short distribution label', () => {
    expect(
      shortDistributionLabel([
        { cueId: 'scan', label: 'SCAN', count: 3 },
        { cueId: 'turn', label: 'TURN', count: 2 },
        { cueId: 'man_on', label: 'MAN ON', count: 1 },
        { cueId: 'open_body', label: 'OPEN', count: 1 },
      ]),
    ).toBe('SCAN×3 · TURN×2 · MAN ON×1');
  });
});

describe('config envelope', () => {
  it('wraps config with a version and still parses bare legacy JSON', () => {
    const config = createDefaultDrillConfig({ durationSec: 120 });
    const wrapped = JSON.parse(serializeConfig(config)) as {
      v: number;
      config: { durationSec: number };
    };
    expect(wrapped.v).toBe(CONFIG_SNAPSHOT_VERSION);
    expect(wrapped.config.durationSec).toBe(120);
    expect(parseConfig(serializeConfig(config)).durationSec).toBe(120);
    expect(parseConfig(JSON.stringify(config)).durationSec).toBe(120);
    // Older ms-based snapshots still normalize.
    expect(parseConfig(JSON.stringify({ durationMs: 90_000 })).durationSec).toBe(90);
  });
});

describe('settings + session mappers', () => {
  it('parses settings with defaults for missing fields', () => {
    const parsed = parseAppSettings(
      JSON.stringify({
        version: 1,
        audio: { rate: 1.15 },
        keepAwakeDefault: false,
      }),
    );
    expect(parsed.audio.rate).toBe(1.15);
    expect(parsed.audio.volume).toBe(DEFAULT_AUDIO_OPTIONS.volume);
    expect(parsed.keepAwakeDefault).toBe(false);
    expect(parsed.drill.enabledCues.length).toBeGreaterThan(0);
  });

  it('falls back to defaults on null settings', () => {
    expect(parseAppSettings(null)).toEqual(createDefaultAppSettings());
  });

  it('maps a save payload into session + cue rows with category/side/completed', () => {
    const input: SaveSessionInput = {
      id: 'session_1',
      startedAtWallMs: 1000,
      endedAtWallMs: 2000,
      durationDrillMs: 900,
      mode: 'audio',
      config: createDefaultDrillConfig(),
      distribution: [{ cueId: 'scan', label: 'SCAN', count: 1 }],
      completed: true,
      cues: [
        {
          seq: 0,
          cueId: 'scan',
          category: 'action',
          phrase: 'Scan',
          side: 'none',
          firedAtEpochMs: 1100,
          firedAtMonoMs: 100,
          plannedOffsetMs: 100,
        },
      ],
    };
    const row = sessionToRow(input, 3000);
    expect(row.synced_at).toBeNull();
    expect(row.server_id).toBeNull();
    expect(row.deleted_at).toBeNull();
    expect(row.verification_json).toBeNull();
    expect(row.cue_count).toBe(1);
    expect(row.completed).toBe(1);
    expect(row.schema_version).toBe(DRILL_SESSION_SCHEMA_VERSION);

    const cues = cueEventsToRows(input.id, input.cues);
    expect(cues[0]).toMatchObject({
      session_id: 'session_1',
      cue_id: 'scan',
      cue_label: 'Scan',
      sequence_index: 0,
      onset_drill_ms: 100,
      planned_offset_ms: 100,
      category: 'action',
      side: 'none',
    });
  });

  it('stores resolved variable phrases as cue_label', () => {
    const cues = cueEventsToRows('session_1', [
      {
        seq: 0,
        cueId: 'color',
        category: 'variable',
        phrase: 'Red',
        side: 'none',
        firedAtEpochMs: 1,
        firedAtMonoMs: 1,
        plannedOffsetMs: 1,
      },
    ]);
    expect(cues[0]?.cue_label).toBe('Red');
    expect(cues[0]?.category).toBe('variable');
  });

  it('maps planned_offset_ms and category/side through detail rows', () => {
    const session = sessionToRow(
      {
        id: 'session_1',
        startedAtWallMs: 1000,
        endedAtWallMs: 2000,
        durationDrillMs: 900,
        mode: 'audio',
        config: createDefaultDrillConfig(),
        distribution: [],
        cues: [],
        completed: false,
      },
      3000,
    ) satisfies SessionRow;
    expect(session.completed).toBe(0);

    const cueRows: CueEventRow[] = [
      {
        id: 'cue_1',
        session_id: 'session_1',
        cue_id: 'check_left',
        cue_label: 'Check left',
        sequence_index: 0,
        onset_wall_ms: 1100,
        onset_drill_ms: 105,
        planned_offset_ms: 100,
        verification_json: null,
        category: 'direction',
        side: 'left',
      },
    ];
    const detail = rowsToDetail(session, cueRows);
    expect(detail.completed).toBe(false);
    expect(detail.cues[0]).toMatchObject({
      label: 'Check left',
      onsetDrillMs: 105,
      plannedOffsetMs: 100,
      category: 'direction',
      side: 'left',
    });
  });

  it('backfills category/side from the catalog when columns are empty', () => {
    const session = sessionToRow(
      {
        id: 'session_1',
        startedAtWallMs: 1,
        endedAtWallMs: 2,
        durationDrillMs: 1,
        mode: 'audio',
        config: createDefaultDrillConfig(),
        distribution: [],
        cues: [],
        completed: true,
      },
      3,
    );
    const detail = rowsToDetail(session, [
      {
        id: 'cue_1',
        session_id: 'session_1',
        cue_id: 'check_right',
        cue_label: 'Check right',
        sequence_index: 0,
        onset_wall_ms: 1,
        onset_drill_ms: 1,
        planned_offset_ms: 1,
        verification_json: null,
        category: '',
        side: '',
      },
    ]);
    expect(detail.cues[0]?.category).toBe('direction');
    expect(detail.cues[0]?.side).toBe('right');
  });
});
