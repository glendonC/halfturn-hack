import { DEFAULT_AUDIO_OPTIONS } from '@/services/audio/types';

import {
  createDefaultAppSettings,
  parseAppSettings,
} from '../mappers';

describe('settings mappers', () => {
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
});
