import * as Speech from 'expo-speech';

import type { Settings } from '@/types';
import type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
import { estimateSpeechMs } from './estimate';
import { resolveVoiceId } from './voices';

/**
 * Cue engine backed by the device text-to-speech (expo-speech).
 *
 * Key correctness details (from the architecture review of SDK 56 expo-speech):
 * - `Speech.speak()` QUEUES; it does not interrupt. We `Speech.stop()` before
 *   each cue so cues fire on time instead of stacking up.
 * - `Speech.pause()/resume()` are iOS/web only — never used here; the drill
 *   engine pauses by calling `stop()`.
 * - Device volume is the primary loudness control; we still pass `volume` for
 *   Android + future-proofing.
 * - When `settings.voiceId` is null we resolve an Enhanced/natural voice for
 *   the language so cues don't fall back to the compact robotic system default.
 */
export class TtsCueEngine implements AudioCueEngine {
  private settings: Settings | null = null;
  private voiceId: string | undefined;

  async prepare(settings: Settings): Promise<void> {
    this.settings = settings;
    this.voiceId = await resolveVoiceId(settings);
    // Warm the TTS engine with a near-silent priming utterance so the first
    // real cue isn't delayed by cold-start latency (~500-900ms on iOS).
    try {
      await Speech.stop();
      Speech.speak(' ', {
        volume: 0,
        rate: this.rate,
        pitch: this.pitch,
        language: settings.language,
        voice: this.voiceId,
      });
    } catch {
      // ignore — warm-up is best-effort
    }
  }

  estimateMs(phrase: string): number {
    return estimateSpeechMs(phrase, this.rate);
  }

  async speak(phrase: string, options: SpeakOptions = {}): Promise<void> {
    const { interrupt = true, onStart, onDone } = options;
    if (interrupt) {
      try {
        await Speech.stop();
      } catch {
        // ignore
      }
    }
    const s = this.settings;
    // Re-resolve if prepare hasn't run yet (e.g. framing coach before warm-up).
    if (!this.voiceId && s) {
      this.voiceId = await resolveVoiceId(s);
    }
    Speech.speak(phrase, {
      language: s?.language ?? 'en-US',
      rate: this.rate,
      pitch: this.pitch,
      volume: s?.cueVolume ?? 1,
      voice: this.voiceId,
      // iOS: let the system manage its own session so ducking/mixing works.
      useApplicationAudioSession: false,
      onStart: () => onStart?.(),
      onDone: () => onDone?.(),
      onStopped: () => onDone?.(),
      onError: () => onDone?.(),
    });
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
    } catch {
      // ignore
    }
  }

  private get rate(): number {
    return this.settings?.speechRate ?? 1;
  }

  private get pitch(): number {
    return this.settings?.speechPitch ?? 1;
  }
}
