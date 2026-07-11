import type { CueDefinition } from '@/types';

import { estimateSpeechMs } from './estimate';
import type {
  AudioCueEngine,
  AudioCueEngineOptions,
  SpeakCueVars,
} from './types';
import { DEFAULT_AUDIO_OPTIONS } from './types';

/**
 * Future recorded voice-pack backend. Same seam as TtsCueEngine; no clips yet.
 */
export class ClipCueEngine implements AudioCueEngine {
  private options: AudioCueEngineOptions = { ...DEFAULT_AUDIO_OPTIONS };

  setOptions(options: Partial<AudioCueEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }

  async prepare(): Promise<void> {
    // Voice packs will preload clip maps here.
  }

  async testSound(): Promise<void> {
    // No-op until packs ship.
  }

  async speakCue(_cue: CueDefinition, _vars?: SpeakCueVars): Promise<void> {
    // No-op until packs ship — callers should use TtsCueEngine for Phase 1.
  }

  async speakText(_text: string): Promise<void> {
    // No-op until packs ship.
  }

  async stop(): Promise<void> {
    // No-op until packs ship.
  }

  estimateMs(phrase: string): number {
    return estimateSpeechMs(phrase, this.options.rate);
  }

  /** Exposed for diagnostics / future UI */
  getOptions(): AudioCueEngineOptions {
    return { ...this.options };
  }
}
