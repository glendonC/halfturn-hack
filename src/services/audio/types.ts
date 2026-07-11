import type { CueDefinition } from '@/types';

export interface AudioCueEngineOptions {
  /** 0–1; applied on web TTS. Native volume is mostly device/hardware. */
  volume: number;
  /** 1.0 = normal */
  rate: number;
  /** 1.0 = normal */
  pitch: number;
}

/** Optional resolved values for future color/number cue variants */
export interface SpeakCueVars {
  color?: string;
  number?: number | string;
}

export const DEFAULT_AUDIO_OPTIONS: AudioCueEngineOptions = {
  volume: 1,
  rate: 1,
  pitch: 1,
};

/**
 * Swappable cue playback backend.
 * TTS now; recorded voice packs later via ClipCueEngine.
 */
export interface AudioCueEngine {
  /** Configure platform audio session (silent mode, ducking). Idempotent. */
  prepare(): Promise<void>;
  /** Short readiness cue so athletes can verify headphones before a drill */
  testSound(): Promise<void>;
  /**
   * Speak a catalog cue. Always interruptible: a newer speakCue wins immediately.
   * Pass `vars` when a future color/number variant needs a resolved spoken value.
   */
  speakCue(cue: CueDefinition, vars?: SpeakCueVars): Promise<void>;
  stop(): Promise<void>;
  setOptions(options: Partial<AudioCueEngineOptions>): void;
}
