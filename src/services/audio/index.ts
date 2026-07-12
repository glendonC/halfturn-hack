import type { CueAudioSource } from '@/types';
import type { AudioCueEngine } from './AudioCueEngine';
import { TtsCueEngine } from './TtsCueEngine';

let engine: AudioCueEngine | null = null;

/**
 * Returns the shared cue-audio engine. Only the TTS backend is implemented
 * today, so `clips` transparently falls back to TTS until voice packs ship.
 */
export function getAudioCueEngine(_source: CueAudioSource = 'tts'): AudioCueEngine {
  if (!engine) engine = new TtsCueEngine();
  return engine;
}

export type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
export { configureAudioSession } from './audioMode';
export { estimateSpeechMs } from './estimate';
export { playBeep, playConfirm, primeBeep, primeConfirm, releaseBeep } from './beep';
export { listNaturalVoices, listVoicesForLanguage, resolveVoiceId, type VoiceOption } from './voices';
