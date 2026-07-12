import { REVEAL_WINDOW_MS, pickTurnReactColor } from '@/constants/turnReact';
import { CUE_GATE, isReadyForCue } from '@/constants/visionTuning';
import { playBeep, primeBeep, primeConfirm, type AudioCueEngine } from '@/services/audio';
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
    primeConfirm(); // and the verified-turn ding, for the same reason
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

  presentCue(_phrase: string, engine: AudioCueEngine): void {
    playBeep(); // directionless reaction anchor fires FIRST (instant, un-delayed)
    // Then the coach voice. "Check" is deliberately CONSTANT and value-free:
    // speaking the resolved phrase (color/number/side) would hand the player
    // the answer without turning — the ground-truth gating this mode is built
    // on. The beep stays the reaction-time anchor; the word is coaching.
    void engine.speak('Check');
  }

  minIntervalFloorMs(): number {
    return REVEAL_WINDOW_MS + REVEAL_PAD_MS;
  }

  /**
   * Hold a due cue until the camera sees the player RESET (fresh in-frame
   * sample near neutral yaw) — a cue that fires mid-recovery feels out of sync
   * and pollutes reaction time. Fires unconditionally in the no-camera preview
   * and once the hold hits its cap (a lost/occluded player must not stall the
   * drill — they can still hear the beep).
   */
  allowCueNow(verifier: PoseVerifier | null, overdueMs: number, drillMs: number): boolean {
    if (!verifier?.available || !verifier.latest) return true; // beep-only preview
    if (overdueMs >= CUE_GATE.maxHoldMs) return true; // stall valve
    // The verifier owns the neutral band: it is scaled from the player's own measured noise floor
    // when their calibration carries one, so "at neutral" and "is turning" are defined against the
    // same noise (a fixed 20° band is narrower than the noise itself, σ 15-25°).
    return isReadyForCue(verifier.latest(), drillMs, verifier.neutralMaxYawDeg);
  }

  async resolveVerifier(): Promise<PoseVerifier> {
    return getPoseVerifierAsync();
  }
}
