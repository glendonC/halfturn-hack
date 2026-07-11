import type { CueType } from './cues';

/** How cue audio is routed. Affects the audio-session mix/duck behavior. */
export type AudioOutputMode = 'headphones' | 'speaker';

/** Source of cue audio. `tts` is today's default; `clips` is not yet wired. */
export type CueAudioSource = 'tts' | 'clips';

/**
 * Persisted app-wide speech / session settings (production Settings shape).
 * Hack AppSettings.audio maps into the speech fields via speechSettingsFromAudio.
 */
export interface Settings {
  /** Cue loudness, 0..1. */
  cueVolume: number;
  /** TTS speaking rate (~0.5 slow … 1.5 fast; 1.0 = normal-ish). */
  speechRate: number;
  /** TTS pitch (0.5 … 2.0; 1.0 = normal). */
  speechPitch: number;
  /** Selected TTS voice id, or null for the system default. */
  voiceId: string | null;
  /** BCP-47 language for TTS, e.g. "en-US". */
  language: string;
  /** Master cue vocabulary enabled app-wide; drills pick from this subset. */
  enabledVocabulary: CueType[];
  /** Audio routing mode (duck background music on headphones, etc.). */
  audioOutputMode: AudioOutputMode;
  /** Cue audio source: TTS now, recorded clips later. */
  audioSource: CueAudioSource;
  /** Buzz on each cue for eyes-free reinforcement. */
  hapticsEnabled: boolean;
  /** Keep the screen awake during a drill. */
  keepAwake: boolean;
  /** Max out screen brightness while a drill runs. Off by default. */
  brightnessBoost: boolean;
  /** Rotate to landscape during Turn & React. Off by default. */
  turnReactLandscape: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  cueVolume: 1,
  speechRate: 1,
  speechPitch: 1,
  voiceId: null,
  language: 'en-US',
  enabledVocabulary: [],
  audioOutputMode: 'headphones',
  audioSource: 'tts',
  hapticsEnabled: true,
  keepAwake: true,
  brightnessBoost: false,
  turnReactLandscape: false,
};
