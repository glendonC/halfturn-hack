/**
 * CueScheduler — the pure, deterministic core of the drill engine.
 *
 * It owns two decisions and nothing else (no timers, no audio, no React):
 *   1. nextIntervalMs(): how long to wait before the next cue.
 *   2. pickCue(): which cue to fire and what phrase to speak.
 *
 * Keeping this pure means cue sequences are fully reproducible with a seeded
 * RNG and unit-testable without a device. The `useDrillEngine` hook drives it.
 */

import { CUES } from '@/constants/cues';
import type { CueId, DrillConfig, Side } from '@/types';
import { randomFloat, weightedPick, type Rng, type Weighted } from '@/utils/random';

export interface ScheduledCue {
  cueId: CueId;
  side: Side;
  phrase: string;
}

export interface SchedulerState {
  lastCueId: CueId | null;
  lastPhrase: string | null;
}

export function initialSchedulerState(): SchedulerState {
  return { lastCueId: null, lastPhrase: null };
}

/**
 * Gap before the next cue, in ms, sampled uniformly within the configured
 * range. `floorMs` lets the engine enforce a practical minimum (so a cue never
 * fires before the previous utterance finishes — see useDrillEngine).
 */
export function nextIntervalMs(rng: Rng, config: DrillConfig, floorMs = 0): number {
  const min = Math.min(config.intervalMinSec, config.intervalMaxSec);
  const max = Math.max(config.intervalMinSec, config.intervalMaxSec);
  const sampled = Math.round(randomFloat(rng, min, max) * 1000);
  return Math.max(sampled, floorMs);
}

/**
 * Weighted candidate list for the next cue. Exposed for testing.
 *
 * Selection model:
 * - Every enabled cue gets base weight 1.
 * - Left/right balance only applies when BOTH directional cues are enabled: it
 *   shifts the split between them while keeping their combined weight constant
 *   (balance 0.5 => 1/1, 0 => all-left, 1 => all-right). With only one
 *   directional cue enabled, balance is ignored so it can still fire.
 * - avoidImmediateRepeat zeroes the last cue's weight (unless it's the only
 *   enabled cue, in which case repetition is unavoidable).
 */
export function buildCandidates(config: DrillConfig, state: SchedulerState): Weighted<CueId>[] {
  const enabled = config.enabledCues.filter((id): id is CueId => id in CUES);
  const bothDirectional = enabled.includes('check_left') && enabled.includes('check_right');
  const balance = Math.min(1, Math.max(0, config.leftRightBalance));

  const candidates: Weighted<CueId>[] = enabled.map((id) => {
    let weight = 1;
    if (bothDirectional && id === 'check_left') weight = (1 - balance) * 2;
    if (bothDirectional && id === 'check_right') weight = balance * 2;
    return { value: id, weight };
  });

  if (config.avoidImmediateRepeat && state.lastCueId && enabled.length > 1) {
    // Only suppress the last cue if something else still has positive weight —
    // otherwise (e.g. extreme L/R balance already zeroed the alternative) we'd
    // leave an all-zero list and weightedPick would fall back to uniform,
    // defeating both the balance and the no-repeat constraint.
    const remaining = candidates.reduce(
      (sum, c) => (c.value === state.lastCueId ? sum : sum + c.weight),
      0,
    );
    if (remaining > 0) {
      for (const c of candidates) {
        if (c.value === state.lastCueId) c.weight = 0;
      }
    }
  }
  return candidates;
}

/**
 * Pick the next cue and resolve its phrase. Variable cues (color/number)
 * re-roll up to a few times to avoid speaking the same value twice in a row
 * when avoidImmediateRepeat is on. Returns the chosen cue plus the next
 * scheduler state to thread forward.
 */
export function pickCue(
  rng: Rng,
  config: DrillConfig,
  state: SchedulerState,
): { cue: ScheduledCue; nextState: SchedulerState } {
  const candidates = buildCandidates(config, state);
  const cueId = candidates.length > 0 ? weightedPick(rng, candidates) : 'scan';
  const def = CUES[cueId];

  let phrase = def.speak(rng);
  if (config.avoidImmediateRepeat && def.category === 'variable') {
    for (let i = 0; i < 4 && phrase === state.lastPhrase; i += 1) {
      phrase = def.speak(rng);
    }
  }

  return {
    cue: { cueId, side: def.side, phrase },
    nextState: { lastCueId: cueId, lastPhrase: phrase },
  };
}
