import * as Speech from 'expo-speech';

import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';

import type { AudioCueEngine, SpeakOptions } from './AudioCueEngine';
import { configureAudioSession } from './audioMode';
import { estimateSpeechMs } from './estimate';
import type { AudioCueEngineOptions } from './types';

/**
 * Cue engine backed by the device text-to-speech (expo-speech).
 *
 * Key correctness details (from the architecture review of SDK 56 expo-speech):
 * - `Speech.speak()` QUEUES; it does not interrupt. We `Speech.stop()` before
 *   each cue so cues fire on time instead of stacking up.
 * - `Speech.pause()/resume()` are iOS/web only — never used here; the drill
 *   engine pauses by calling `stop()`.
 * - `volume`/`voice` are best-effort (often ignored on iOS).
 */
export class TtsCueEngine implements AudioCueEngine {
  private settings: Settings = { ...DEFAULT_SETTINGS };

  /** Map hack AppSettings.audio into the production Settings fields. */
  setOptions(options: Partial<AudioCueEngineOptions>): void {
    this.settings = {
      ...this.settings,
      cueVolume: clamp01(options.volume ?? this.settings.cueVolume),
      speechRate: clampRate(options.rate ?? this.settings.speechRate),
      speechPitch: clampPitch(options.pitch ?? this.settings.speechPitch),
    };
  }

  async prepare(settings?: Settings): Promise<void> {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }
    await configureAudioSession(this.settings.audioOutputMode);
    // Warm the TTS engine with a near-silent priming utterance so the first
    // real cue isn't delayed by cold-start latency (~500-900ms on iOS).
    try {
      await Speech.stop();
      Speech.speak(' ', {
        volume: 0,
        rate: this.rate,
        pitch: this.pitch,
        language: this.settings.language,
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
    Speech.speak(phrase, {
      language: s.language,
      rate: this.rate,
      pitch: this.pitch,
      volume: s.cueVolume,
      voice: s.voiceId ?? undefined,
      // iOS: let the system manage its own session so ducking/mixing works.
      useApplicationAudioSession: false,
      onStart: () => onStart?.(),
      onDone: () => onDone?.(),
      onStopped: () => onDone?.(),
      onError: () => onDone?.(),
    });
  }

  /** Readiness line for pre-drill headphone check. */
  async testSound(): Promise<void> {
    await this.speak('HalfTurn ready');
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
    } catch {
      // ignore
    }
  }

  private get rate(): number {
    return this.settings.speechRate;
  }

  private get pitch(): number {
    return this.settings.speechPitch;
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function clampRate(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(2, Math.max(0.1, value));
}

function clampPitch(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}
