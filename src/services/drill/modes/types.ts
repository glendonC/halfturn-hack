import type { AudioCueEngine } from '@/services/audio';
import type { PoseVerifier } from '@/services/vision';
import type { DrillConfig, DrillMode } from '@/types';
import type { Rng } from '@/utils/random';

import type { ScheduledCue, SchedulerState } from '../CueScheduler';

/**
 * Running-drill layouts. Modes map here via MODE_LAYOUT; active screens pick
 * a component from the UI registry without branching on mode strings.
 */
export type DrillLayout = 'audio-hud' | 'turn-react-surface';

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
 * Per-mode strategy. The store owns timers / clocks / haptics / persistence and
 * DELEGATES mode-specific decisions here instead of `if (mode === 'turn_react')`
 * at every site. New modes = new behavior + one registry line.
 */
export interface DrillModeBehavior {
  readonly mode: DrillMode;

  /** Mode-specific audio prep before the run (turn-react primes the beep). */
  prepareAudio(engine: AudioCueEngine): void;

  /**
   * Adjust a freshly-picked cue's phrase. Turn-react re-rolls the `color` cue
   * from the readable full-screen palette; audio passes the cue through.
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

  /** Floor for the next-cue gap so a cue never overruns utterance / reveal. */
  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number;

  /** Pose verifier for the run (NullPoseVerifier until native unlock). */
  resolveVerifier(): PoseVerifier;
}
