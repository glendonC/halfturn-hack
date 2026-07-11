import type { CueAudioSource, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/constants/defaults';

import type { AudioCueEngine } from './AudioCueEngine';
import { TtsCueEngine } from './TtsCueEngine';
import type { AudioCueEngineOptions } from './types';

let engine: AudioCueEngine | null = null;

/**
 * Returns the shared cue-audio engine. Only the TTS backend is implemented
 * today, so `clips` transparently falls back to TTS until voice packs ship.
 */
export function getAudioCueEngine(
  _source: CueAudioSource = 'tts',
): AudioCueEngine {
  if (!engine) engine = new TtsCueEngine();
  return engine;
}

/** Map a legacy audio options bag into Settings speech fields. */
export function speechSettingsFromAudio(
  audio: AudioCueEngineOptions,
  patch: Partial<Settings> = {},
): Settings {
  return {
    ...DEFAULT_SETTINGS,
    cueVolume: audio.volume,
    speechRate: audio.rate,
    speechPitch: audio.pitch,
    ...patch,
  };
}

export type { CueAudioSource };
