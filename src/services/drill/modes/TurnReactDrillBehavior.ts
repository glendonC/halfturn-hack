import type { AudioCueEngine } from '@/services/audio';
import { primeBeep, playBeep } from '@/services/audio';
import {
  REVEAL_PAD_MS,
  REVEAL_WINDOW_MS,
  pickTurnReactColor,
} from '@/constants/turnReact';
import { createPoseVerifier, type PoseVerifier } from '@/services/vision';
import type { CueDefinition, DrillConfig } from '@/types';

import type { DrillModeBehavior, PickedCue, ResolvedCue } from './types';

/** Re-roll cap for the color palette (matches scheduler variable re-roll spirit). */
const COLOR_REROLL_TRIES = 4;

/**
 * Turn-and-react preview: screen is the cue surface; a directionless beep is
 * the only audio. Pose stays NullPoseVerifier until Phase 2 unlock.
 */
export class TurnReactDrillBehavior implements DrillModeBehavior {
  readonly mode = 'turn_react' as const;

  prepareAudio(_engine: AudioCueEngine): void {
    primeBeep();
  }

  /**
   * The `color` cue's flood IS the on-screen information, so it draws from the
   * readable turn-react palette (no White/Black) rather than the spoken-cue
   * palette. Re-roll when avoidLastN > 0 and the pick matches the prior phrase.
   */
  resolveCue(
    picked: PickedCue,
    rng: () => number,
    config: DrillConfig,
    priorPhrase: string | null,
  ): ResolvedCue {
    if (picked.cue.id !== 'color') {
      return { phrase: picked.phrase };
    }
    let c = pickTurnReactColor(rng);
    const avoidRepeat = config.avoidLastN > 0;
    for (
      let i = 0;
      i < COLOR_REROLL_TRIES && avoidRepeat && c.name === priorPhrase;
      i += 1
    ) {
      c = pickTurnReactColor(rng);
    }
    return { phrase: c.name };
  }

  presentCue(_cue: CueDefinition, _phrase: string, _engine: AudioCueEngine): void {
    playBeep();
  }

  minIntervalFloorMs(_phrase: string, _engine: AudioCueEngine): number {
    return REVEAL_WINDOW_MS + REVEAL_PAD_MS;
  }

  resolveVerifier(): PoseVerifier {
    return createPoseVerifier();
  }
}
