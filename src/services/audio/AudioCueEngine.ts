import type { Settings } from '@/types';

export interface SpeakOptions {
  /** Interrupt any in-flight/queued utterance before speaking. Default true. */
  interrupt?: boolean;
  onStart?: () => void;
  onDone?: () => void;
}

/**
 * Pluggable cue-audio backend. Today's default ships `TtsCueEngine` (expo-speech);
 * a future `ClipCueEngine` (expo-audio, recorded voice packs) can implement the
 * same interface and be selected by `Settings.audioSource` with zero changes to
 * the drill engine.
 */
export interface AudioCueEngine {
  /** Apply settings (voice/rate/pitch/volume) and warm the backend. */
  prepare(settings: Settings): Promise<void>;
  /** Speak a phrase; resolves once the utterance has been dispatched. */
  speak(phrase: string, options?: SpeakOptions): Promise<void>;
  /** Estimated utterance duration in ms (used to floor cue intervals). */
  estimateMs(phrase: string): number;
  /** Stop any in-flight and queued audio. */
  stop(): Promise<void>;
}
