import type { AudioCueEngine } from '@/services/audio';
import { createPoseVerifier, type PoseVerifier } from '@/services/vision';

import type { DrillModeBehavior, PickedCue, ResolvedCue } from './types';

/** Utterance-length pad so a cue never fires before the last one finishes. */
const UTTERANCE_PAD_MS = 250;

/**
 * Audio-cue drill: spoken cues, eyes-up, no camera. Phrase unchanged from the
 * scheduler, spoken via TTS; next gap floored at estimated utterance length.
 */
export class AudioDrillBehavior implements DrillModeBehavior {
  readonly mode = 'audio' as const;

  prepareAudio(_engine: AudioCueEngine): void {
    /* no extra prep beyond engine.prepare() */
  }

  resolveCue(picked: PickedCue): ResolvedCue {
    return { phrase: picked.cue.phrase, nextState: picked.nextState };
  }

  presentCue(phrase: string, engine: AudioCueEngine): void {
    void engine.speakText(phrase);
  }

  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number {
    return engine.estimateMs(phrase) + UTTERANCE_PAD_MS;
  }

  resolveVerifier(): PoseVerifier {
    return createPoseVerifier();
  }
}
