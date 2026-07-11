/**
 * Hack-only audio option bag persisted in AppSettings.
 * Maps into production {@link Settings} via speechSettingsFromAudio.
 */

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
