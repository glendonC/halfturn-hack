/**
 * Rough estimate of how long a TTS phrase takes to speak, so the scheduler
 * never plans the next cue before the previous utterance finishes (which
 * would otherwise interrupt mid-phrase or drift the timeline).
 */
export function estimateSpeechMs(phrase: string, rate = 1): number {
  const words = Math.max(1, phrase.trim().split(/\s+/).length);
  const perWordMs = 360 / Math.max(0.5, rate);
  const guardMs = 350; // dispatch + Bluetooth latency cushion
  return Math.round(words * perWordMs + guardMs);
}
