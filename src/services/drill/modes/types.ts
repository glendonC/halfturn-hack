import type { AudioCueEngine } from '@/services/audio';
import type { PoseVerifier } from '@/services/vision';
import type { CueDefinition, DrillConfig, DrillMode } from '@/types';

/**
 * Running-drill layouts. Modes map here via MODE_LAYOUT; active screens pick
 * a component from the UI registry without branching on mode strings.
 */
export type DrillLayout = 'audio-hud' | 'turn-react-surface';

/** Freshly fired cue + phrase before any mode-specific adjustment. */
export interface PickedCue {
  cue: CueDefinition;
  phrase: string;
}

/** Phrase after mode resolve (turn-react may re-roll color). */
export interface ResolvedCue {
  phrase: string;
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
   * Adjust a freshly-fired cue's phrase. Audio passes through; turn-react
   * re-rolls `color` from the readable flood palette (no White/Black).
   * `priorPhrase` is the previous on-screen / spoken phrase (for avoid-repeat).
   */
  resolveCue(
    picked: PickedCue,
    rng: () => number,
    config: DrillConfig,
    priorPhrase: string | null,
  ): ResolvedCue;

  /** Present cue audio: TTS speaks; turn-react plays a directionless beep. */
  presentCue(cue: CueDefinition, phrase: string, engine: AudioCueEngine): void;

  /** Floor for the next-cue gap so a cue never overruns utterance / reveal. */
  minIntervalFloorMs(phrase: string, engine: AudioCueEngine): number;

  /** Pose verifier for the run (NullPoseVerifier until Phase 2 unlock). */
  resolveVerifier(): PoseVerifier;
}
