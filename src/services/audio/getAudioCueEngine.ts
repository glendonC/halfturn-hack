import { ClipCueEngine } from './ClipCueEngine';
import { TtsCueEngine } from './TtsCueEngine';
import type { AudioCueEngine } from './types';

export type CueAudioSource = 'tts' | 'clips';

/**
 * Factory for the active cue engine. Default remains TTS for Expo Go.
 * Clip packs opt in later without rewriting the drill store.
 */
export function getAudioCueEngine(
  source: CueAudioSource = 'tts',
): AudioCueEngine {
  if (source === 'clips') {
    const clips = new ClipCueEngine();
    clips.setTtsFallback(new TtsCueEngine());
    return clips;
  }
  return new TtsCueEngine();
}
