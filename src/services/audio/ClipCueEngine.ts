import type { Settings } from '@/types';
import type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
import { estimateSpeechMs } from './estimate';

/**
 * PLACEHOLDER (not yet wired): recorded voice-pack cue engine.
 *
 * The intent is to back cues with pre-rendered audio clips played via
 * expo-audio's `AudioPlayer`, which honors `playsInSilentMode` more reliably
 * than TTS on iOS and gives a real coach's voice. It implements the same
 * `AudioCueEngine` interface so it can be swapped in via `getAudioCueEngine`
 * with no changes to the drill engine.
 *
 * Not yet wired — `getAudioCueEngine` returns the TTS engine for now.
 * See ROADMAP.md ("Voice packs").
 */
export class ClipCueEngine implements AudioCueEngine {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async prepare(_settings: Settings): Promise<void> {
    throw new Error('ClipCueEngine is not implemented yet (voice packs, a later addition).');
  }

  estimateMs(phrase: string): number {
    return estimateSpeechMs(phrase);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async speak(_phrase: string, _options?: SpeakOptions): Promise<void> {
    throw new Error('ClipCueEngine is not implemented yet.');
  }

  async stop(): Promise<void> {
    /* no-op */
  }
}
