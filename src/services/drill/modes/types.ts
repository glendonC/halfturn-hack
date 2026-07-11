import type { AudioCueEngine } from '@/services/audio';
import type { PoseVerifier } from '@/services/vision';
import type { DrillConfig, DrillMode } from '@/types';
import type { Rng } from '@/utils/random';
import type { ScheduledCue, SchedulerState } from '../CueScheduler';

/**
 * The set of running-drill layouts. A mode maps to one of these via `MODE_LAYOUT`,
 * and the active screen renders the matching component from the UI-layer layout
 * registry — this type is the shared vocabulary between the two.
 */
export type DrillLayout = 'audio-hud' | 'turn-react-facetime';

/** A picked cue plus the scheduler state to thread forward (pickCue's shape). */
export interface PickedCue {
  cue: ScheduledCue;
  nextState: SchedulerState;
}

/** The phrase + threaded scheduler state after any mode-specific adjustment. */
export interface ResolvedCue {
  phrase: string;
  nextState: SchedulerState;
}

/**
 * Per-mode strategy. The drill engine owns the timer/clock/haptics/persistence
 * and DELEGATES only the mode-specific decisions here, instead of branching on
 * `if (mode === 'turn-react')` at every site. Adding a mode (or adaptive
 * difficulty) becomes additive: a new behavior in this folder + one registry
 * line — the engine never changes. See docs/perception-architecture.md §4.
 */
export interface DrillModeBehavior {
  readonly mode: DrillMode;

  /** Mode-specific audio prep before the run (turn-react primes the beep). */
  prepareAudio(engine: AudioCueEngine): void;

  /**
   * Adjust a freshly-picked cue's phrase. Turn-react re-rolls the `color` cue
   * from the readable full-screen palette (no White/Black) and honors
   * avoid-immediate-repeat against `priorState`; audio passes the cue through.
   * `priorState` is the scheduler state BEFORE this cue.
   */
  resolveCue(
    picked: PickedCue,
    rng: Rng,
    config: DrillConfig,
    priorState: SchedulerState,
  ): ResolvedCue;

  /** Present the cue's AUDIO: TTS speaks the phrase; turn-react plays a beep. */
  presentCue(phrase: string, engine: AudioCueEngine): void;

  /** Floor for the next-cue gap so a cue never overruns the utterance/reveal. */
  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number;

  /** Resolve the pose verifier for the run (real for turn-react, no-op else). */
  resolveVerifier(): Promise<PoseVerifier>;
}
