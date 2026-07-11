export { configureDrillAudioSession } from './audioSession';
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
  type CueAudioSource,
} from './getAudioCueEngine';
export { phraseToSpeakVars, resolveSpokenText } from './resolveSpokenText';
export { speakCatalogCue, TtsCueEngine } from './TtsCueEngine';
export {
  DEFAULT_AUDIO_OPTIONS,
  type AudioCueEngine,
  type AudioCueEngineOptions,
  type SpeakCueVars,
} from './types';
