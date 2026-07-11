import type { AudioCueEngine } from '@/services/audio';
import { NullPoseVerifier, type PoseVerifier } from '@/services/vision';
import type { DrillModeBehavior, PickedCue, ResolvedCue } from './types';

/** Utterance-length pad so a cue never fires before the last one finishes. */
const UTTERANCE_PAD_MS = 250;

/**
 * The audio-cue drill: spoken cues, eyes-up, no camera. The cue phrase is
 * unchanged from the scheduler, spoken via TTS, and the next gap is floored at
 * the estimated utterance length so cues never stack. No pose verification.
 */
export class AudioDrillBehavior implements DrillModeBehavior {
  readonly mode = 'audio' as const;

  prepareAudio(): void {
    /* audio needs no extra prep beyond engine.prepare() */
  }

  resolveCue(picked: PickedCue): ResolvedCue {
    return { phrase: picked.cue.phrase, nextState: picked.nextState };
  }

  presentCue(phrase: string, engine: AudioCueEngine): void {
    void engine.speak(phrase);
  }

  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number {
    return engine.estimateMs(phrase) + UTTERANCE_PAD_MS;
  }

  async resolveVerifier(): Promise<PoseVerifier> {
    return new NullPoseVerifier();
  }
}
