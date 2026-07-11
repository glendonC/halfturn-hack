import { REVEAL_WINDOW_MS, pickTurnReactColor } from '@/constants/turnReact';
import { playBeep, primeBeep, type AudioCueEngine } from '@/services/audio';
import { getPoseVerifierAsync, type PoseVerifier } from '@/services/vision';
import type { DrillConfig } from '@/types';
import type { Rng } from '@/utils/random';
import type { SchedulerState } from '../CueScheduler';
import type { DrillModeBehavior, PickedCue, ResolvedCue } from './types';

/** Pad past the reveal window so the next cue never fires while a value shows. */
const REVEAL_PAD_MS = 250;
/** Re-roll cap for the color palette (matches CueScheduler's variable re-roll). */
const COLOR_REROLL_TRIES = 4;

/**
 * The turn-and-react camera mode: the screen is the cue surface, so the resolved value
 * is SHOWN (not spoken) and a directionless beep is the only audio — the player
 * must physically half-turn to read it. Camera pose verification is wired via a
 * real backend when the dev build enables it (`getPoseVerifierAsync`); in Expo
 * Go that resolves the no-op verifier, so this mode degrades to a beep preview.
 */
export class TurnReactDrillBehavior implements DrillModeBehavior {
  readonly mode = 'turn-react' as const;

  prepareAudio(): void {
    primeBeep(); // warm the beep sink so the first cue isn't silent/late
  }

  /**
   * The `color` cue's flood IS the on-screen information, so it draws from the
   * readable turn-react palette (no White/Black) rather than the spoken-cue
   * palette. Re-roll to honor avoid-immediate-repeat against the PRIOR phrase
   * (CueScheduler already de-duped the discarded spoken color, not this one).
   */
  resolveCue(
    picked: PickedCue,
    rng: Rng,
    config: DrillConfig,
    priorState: SchedulerState,
  ): ResolvedCue {
    if (picked.cue.cueId !== 'color') {
      return { phrase: picked.cue.phrase, nextState: picked.nextState };
    }
    let c = pickTurnReactColor(rng);
    for (
      let i = 0;
      i < COLOR_REROLL_TRIES && config.avoidImmediateRepeat && c.name === priorState.lastPhrase;
      i += 1
    ) {
      c = pickTurnReactColor(rng);
    }
    return { phrase: c.name, nextState: { ...picked.nextState, lastPhrase: c.name } };
  }

  presentCue(): void {
    playBeep(); // directionless reaction anchor; the value stays on screen only
  }

  minIntervalFloorMs(): number {
    return REVEAL_WINDOW_MS + REVEAL_PAD_MS;
  }

  async resolveVerifier(): Promise<PoseVerifier> {
    return getPoseVerifierAsync();
  }
}
