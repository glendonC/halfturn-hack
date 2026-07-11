import type { AudioCueEngine } from '@/services/audio';
import { primeBeep, playBeep } from '@/services/audio';
import { REVEAL_PAD_MS, REVEAL_WINDOW_MS } from '@/constants/turnReact';
import { NullPoseVerifier, type PoseVerifier } from '@/services/vision';
import type { CueDefinition } from '@/types';

import type { DrillModeBehavior, PickedCue, ResolvedCue } from './types';

/**
 * Turn-and-react preview: screen is the cue surface; a directionless beep is
 * the only audio. Pose stays NullPoseVerifier until Phase 2 unlock.
 */
export class TurnReactDrillBehavior implements DrillModeBehavior {
  readonly mode = 'turn_react' as const;

  prepareAudio(_engine: AudioCueEngine): void {
    primeBeep();
  }

  resolveCue(picked: PickedCue): ResolvedCue {
    // Color re-roll onto the readable flood palette lands in a later issue.
    return { phrase: picked.phrase };
  }

  presentCue(_cue: CueDefinition, _phrase: string, _engine: AudioCueEngine): void {
    playBeep();
  }

  minIntervalFloorMs(_phrase: string, _engine: AudioCueEngine): number {
    return REVEAL_WINDOW_MS + REVEAL_PAD_MS;
  }

  resolveVerifier(): PoseVerifier {
    return new NullPoseVerifier();
  }
}
