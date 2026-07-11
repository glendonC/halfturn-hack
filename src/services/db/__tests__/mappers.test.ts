import { createDefaultDrillConfig } from '@/constants';
import { DEFAULT_AUDIO_OPTIONS } from '@/services/audio/types';

import {
  createDefaultAppSettings,
  parseAppSettings,
  parseDistribution,
  serializeDistribution,
  sessionToRow,
  shortDistributionLabel,
  cueEventsToRows,
} from '../mappers';
import type { SaveSessionInput } from '../types';

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

  it('maps a save payload into session + cue rows with sync placeholders null', () => {
    const input: SaveSessionInput = {
      id: 'session_1',
      startedAtWallMs: 1000,
      endedAtWallMs: 2000,
      durationDrillMs: 900,
      mode: 'audio',
      config: createDefaultDrillConfig(),
      distribution: [{ cueId: 'scan', label: 'SCAN', count: 1 }],
      cues: [
        {
          id: 'cue_1',
          cueId: 'scan',
          index: 0,
          onsetWallMs: 1100,
          onsetDrillMs: 100,
          verification: null,
        },
      ],
    };
    const row = sessionToRow(input, 3000);
    expect(row.synced_at).toBeNull();
    expect(row.server_id).toBeNull();
    expect(row.deleted_at).toBeNull();
    expect(row.verification_json).toBeNull();
    expect(row.cue_count).toBe(1);

    const cues = cueEventsToRows(input.id, input.cues);
    expect(cues[0]).toMatchObject({
      session_id: 'session_1',
      cue_id: 'scan',
      cue_label: 'SCAN',
      sequence_index: 0,
      onset_drill_ms: 100,
    });
  });
});
