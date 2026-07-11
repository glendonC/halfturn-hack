export type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
export { configureAudioSession } from './audioMode';
export { primeBeep, playBeep, releaseBeep } from './beep';
export { ClipCueEngine } from './ClipCueEngine';
export {
  findClip,
  type ClipManifest,
  type ClipManifestEntry,
} from './clipManifest';
export { estimateSpeechMs } from './estimate';
export {
  getAudioCueEngine,
  speechSettingsFromAudio,
  type CueAudioSource,
} from './getAudioCueEngine';
export { phraseToSpeakVars, resolveSpokenText } from './resolveSpokenText';
export { TtsCueEngine } from './TtsCueEngine';
export {
  DEFAULT_AUDIO_OPTIONS,
  type AudioCueEngineOptions,
  type SpeakCueVars,
} from './types';
