import {
  phraseToSpeakVars,
  type AudioCueEngine,
} from '@/services/audio';
import { createPoseVerifier, type PoseVerifier } from '@/services/vision';
import type { CueDefinition, DrillConfig } from '@/types';

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

  resolveCue(
    picked: PickedCue,
    _rng: () => number,
    _config: DrillConfig,
    _priorPhrase: string | null,
  ): ResolvedCue {
    return { phrase: picked.phrase };
  }

  presentCue(cue: CueDefinition, phrase: string, engine: AudioCueEngine): void {
    void engine.speakCue(cue, phraseToSpeakVars(cue.id, phrase));
  }

  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number {
    return engine.estimateMs(phrase) + UTTERANCE_PAD_MS;
  }

  resolveVerifier(): PoseVerifier {
    return createPoseVerifier();
  }
}
