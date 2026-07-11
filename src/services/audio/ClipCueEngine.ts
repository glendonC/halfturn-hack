import type { CueDefinition } from '@/types';

import { findClip, type ClipManifest } from './clipManifest';
import { estimateSpeechMs } from './estimate';
import type {
  AudioCueEngine,
  AudioCueEngineOptions,
  SpeakCueVars,
} from './types';
import { DEFAULT_AUDIO_OPTIONS } from './types';

/**
 * Future recorded voice-pack backend. Same seam as TtsCueEngine.
 * Missing clips fall back to optional TTS engine when wired; otherwise no-op.
 */
export class ClipCueEngine implements AudioCueEngine {
  private options: AudioCueEngineOptions = { ...DEFAULT_AUDIO_OPTIONS };
  private manifest: ClipManifest | null = null;
  private ttsFallback: AudioCueEngine | null = null;

  setOptions(options: Partial<AudioCueEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /** Attach a clip map (empty until packs ship). */
  setManifest(manifest: ClipManifest | null): void {
    this.manifest = manifest;
  }

  /** Optional TTS engine used when a clip is missing. */
  setTtsFallback(engine: AudioCueEngine | null): void {
    this.ttsFallback = engine;
  }

  async prepare(): Promise<void> {
    // Voice packs will preload clip maps here.
    await this.ttsFallback?.prepare();
  }

  async testSound(): Promise<void> {
    if (this.ttsFallback) {
      await this.ttsFallback.testSound();
      return;
    }
    // No-op until packs ship.
  }

  async speakCue(cue: CueDefinition, vars?: SpeakCueVars): Promise<void> {
    const clip = findClip(this.manifest, cue.id);
    if (clip) {
      // Clip playback lands with expo-audio players once assets exist.
      return;
    }
    if (this.ttsFallback) {
      await this.ttsFallback.speakCue(cue, vars);
    }
  }

  async speakText(text: string): Promise<void> {
    if (this.ttsFallback) {
      await this.ttsFallback.speakText(text);
    }
  }

  async stop(): Promise<void> {
    await this.ttsFallback?.stop();
  }

  estimateMs(phrase: string): number {
    return estimateSpeechMs(phrase, this.options.rate);
  }

  /** Exposed for diagnostics / future UI */
  getOptions(): AudioCueEngineOptions {
    return { ...this.options };
  }

  getManifest(): ClipManifest | null {
    return this.manifest;
  }
}
