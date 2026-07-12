import type { CueId } from './drill';

/** How cue audio is routed. Affects the audio-session mix/duck behavior. */
export type AudioOutputMode = 'headphones' | 'speaker';

/** Source of cue audio. `tts` is today's default; `clips` is not yet wired. */
export type CueAudioSource = 'tts' | 'clips';

/** Persisted app-wide settings. */
export interface Settings {
  /** Cue loudness, 0..1. */
  cueVolume: number;
  /** TTS speaking rate (~0.5 slow … 1.5 fast; 1.0 = normal-ish). */
  speechRate: number;
  /** TTS pitch (0.5 … 2.0; 1.0 = normal). */
  speechPitch: number;
  /** Selected TTS voice id, or null to auto-pick the best Enhanced/natural voice. */
  voiceId: string | null;
  /** BCP-47 language for TTS, e.g. "en-US". */
  language: string;
  /** Master cue vocabulary enabled app-wide; drills pick from this subset. */
  enabledVocabulary: CueId[];
  /** Audio routing mode (duck background music on headphones, etc.). */
  audioOutputMode: AudioOutputMode;
  /** Cue audio source: TTS now, recorded clips later. */
  audioSource: CueAudioSource;
  /** Buzz on each cue for eyes-free reinforcement. */
  hapticsEnabled: boolean;
  /** Keep the screen awake during a drill. */
  keepAwake: boolean;
  /** Max out screen brightness while a drill runs (outdoor visibility). Off by default. */
  brightnessBoost: boolean;
  /** Rotate to landscape during a Turn & React drill (bigger cue at distance). Off by default. */
  turnReactLandscape: boolean;
}
