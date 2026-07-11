import type { Settings } from '@/types';

import type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
import { estimateSpeechMs } from './estimate';

/**
 * PLACEHOLDER (not yet wired): recorded voice-pack cue engine.
 * getAudioCueEngine still returns TTS today.
 */
export class ClipCueEngine implements AudioCueEngine {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async prepare(_settings: Settings): Promise<void> {
    throw new Error(
      'ClipCueEngine is not implemented yet (voice packs, a later addition).',
    );
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
