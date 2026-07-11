import * as Speech from 'expo-speech';

import { getCueDefinition } from '@/constants';
import type { CueDefinition } from '@/types';

import { configureDrillAudioSession } from './audioSession';
import { estimateSpeechMs } from './estimate';
import { resolveSpokenText } from './resolveSpokenText';
import type {
  AudioCueEngine,
  AudioCueEngineOptions,
  SpeakCueVars,
} from './types';
import { DEFAULT_AUDIO_OPTIONS } from './types';

/**
 * Offline TTS cue engine via expo-speech — zero audio assets.
 * New cues always interrupt in-flight speech so timing stays honest.
 */
export class TtsCueEngine implements AudioCueEngine {
  private options: AudioCueEngineOptions = { ...DEFAULT_AUDIO_OPTIONS };
  private prepared = false;
  /** Bumps on every speak/stop so superseded utterances finish cleanly */
  private generation = 0;

  setOptions(options: Partial<AudioCueEngineOptions>): void {
    this.options = {
      ...this.options,
      ...options,
      volume: clamp01(options.volume ?? this.options.volume),
      rate: clampRate(options.rate ?? this.options.rate),
      pitch: clampPitch(options.pitch ?? this.options.pitch),
    };
  }

  async prepare(): Promise<void> {
    await configureDrillAudioSession();
    this.prepared = true;
  }

  async testSound(): Promise<void> {
    await this.ensurePrepared();
    // Neutral readiness line — not a drill cue.
    await this.utter('HalfTurn ready');
  }

  async speakCue(cue: CueDefinition, vars?: SpeakCueVars): Promise<void> {
    await this.ensurePrepared();
    const text = resolveSpokenText(cue, vars);
    await this.speakText(text);
  }

  async speakText(text: string): Promise<void> {
    await this.ensurePrepared();
    await this.utter(text);
  }

  async stop(): Promise<void> {
    this.generation += 1;
    await Speech.stop();
  }

  estimateMs(phrase: string): number {
    return estimateSpeechMs(phrase, this.options.rate);
  }

  private async ensurePrepared(): Promise<void> {
    if (!this.prepared) {
      await this.prepare();
    }
  }

  private async utter(text: string): Promise<void> {
    const generation = ++this.generation;
    // expo-speech queues by default — stop first so the new cue always wins.
    await Speech.stop();
    if (generation !== this.generation) return;

    const { rate, pitch, volume } = this.options;

    await new Promise<void>((resolve, reject) => {
      if (generation !== this.generation) {
        resolve();
        return;
      }

      Speech.speak(text, {
        language: 'en-US',
        rate,
        pitch,
        volume,
        // Use the session from configureDrillAudioSession (silent mode / ducking).
        useApplicationAudioSession: true,
        onDone: () => {
          if (generation === this.generation) resolve();
        },
        onStopped: () => {
          if (generation === this.generation) resolve();
        },
        onError: (error) => {
          if (generation === this.generation) reject(error);
        },
      });
    });
  }
}

/** Convenience: speak a catalog id through a shared engine instance pattern */
export async function speakCatalogCue(
  engine: AudioCueEngine,
  cueId: CueDefinition['id'],
  vars?: SpeakCueVars,
): Promise<void> {
  await engine.speakCue(getCueDefinition(cueId), vars);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function clampRate(value: number): number {
  if (Number.isNaN(value)) return 1;
  // expo-speech is happiest in a modest band
  return Math.min(2, Math.max(0.1, value));
}

function clampPitch(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}
