/**
 * CueScheduler — the pure, deterministic core of the drill engine.
 *
 * Lifted from production HalfTurn. Owns two decisions and nothing else
 * (no timers, no audio, no React):
 *   1. nextIntervalMs(): how long to wait before the next cue.
 *   2. pickCue(): which cue to fire and what phrase to speak.
 *
 * Hack DrillConfig uses intervalMs + avoidLastN; production uses
 * intervalMinSec/MaxSec + avoidImmediateRepeat. Mapped at the call edge.
 */

import {
  CUE_BY_ID,
  isVariableCue,
  resolveCuePhrase,
} from '@/constants';
import type { CueSide, CueType, DrillConfig } from '@/types';
import {
  randomFloat,
  weightedPick,
  type Rng,
  type Weighted,
} from '@/utils/random';

export interface ScheduledCue {
  cueId: CueType;
  side: CueSide;
  phrase: string;
}

export interface SchedulerState {
  lastCueId: CueType | null;
  lastPhrase: string | null;
}

export function initialSchedulerState(): SchedulerState {
  return { lastCueId: null, lastPhrase: null };
}

/** Production avoidImmediateRepeat ↔ hack avoidLastN > 0. */
function avoidImmediateRepeat(config: DrillConfig): boolean {
  return config.avoidLastN > 0;
}

/**
 * Gap before the next cue, in ms, sampled uniformly within the configured
 * range. `floorMs` lets the engine enforce a practical minimum (so a cue never
 * fires before the previous utterance finishes).
 */
export function nextIntervalMs(
  rng: Rng,
  config: DrillConfig,
  floorMs = 0,
): number {
  const min = Math.min(config.intervalMs.min, config.intervalMs.max);
  const max = Math.max(config.intervalMs.min, config.intervalMs.max);
  const sampled = Math.round(randomFloat(rng, min, max));
  return Math.max(sampled, floorMs);
}

/**
 * Weighted candidate list for the next cue. Exposed for testing.
 *
 * Selection model:
 * - Every enabled cue gets base weight 1.
 * - Left/right balance only applies when BOTH directional cues are enabled.
 * - avoidImmediateRepeat zeroes the last cue's weight (unless it's the only
 *   enabled cue with remaining weight).
 */
export function buildCandidates(
  config: DrillConfig,
  state: SchedulerState,
): Weighted<CueType>[] {
  const enabled = config.enabledCues.filter((id): id is CueType => id in CUE_BY_ID);
  const bothDirectional =
    enabled.includes('check_left') && enabled.includes('check_right');
  const balance = Math.min(1, Math.max(0, config.leftRightBalance));

  const candidates: Weighted<CueType>[] = enabled.map((id) => {
    let weight = 1;
    if (bothDirectional && id === 'check_left') weight = (1 - balance) * 2;
    if (bothDirectional && id === 'check_right') weight = balance * 2;
    return { value: id, weight };
  });

  if (avoidImmediateRepeat(config) && state.lastCueId && enabled.length > 1) {
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
 * when avoidImmediateRepeat is on.
 */
export function pickCue(
  rng: Rng,
  config: DrillConfig,
  state: SchedulerState,
): { cue: ScheduledCue; nextState: SchedulerState } {
  const candidates = buildCandidates(config, state);
  const cueId =
    candidates.length > 0 ? weightedPick(rng, candidates) : ('scan' as CueType);
  const def = CUE_BY_ID[cueId];

  let phrase = resolveCuePhrase(cueId, rng);
  if (avoidImmediateRepeat(config) && isVariableCue(cueId)) {
    for (let i = 0; i < 4 && phrase === state.lastPhrase; i += 1) {
      phrase = resolveCuePhrase(cueId, rng);
    }
  }

  return {
    cue: { cueId, side: def.side, phrase },
    nextState: { lastCueId: cueId, lastPhrase: phrase },
  };
}
