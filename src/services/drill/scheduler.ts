/**
 * Store-facing timing wrapper around CueScheduler.
 * Pick/phrase decisions live in CueScheduler; this tracks when the next cue fires.
 */

import { getCueDefinition } from '@/constants';
import type {
  CueDefinition,
  CueEvent,
  DrillConfig,
  DrillMs,
  WallMs,
} from '@/types';
import type { Rng } from '@/utils/random';

import {
  initialSchedulerState,
  nextIntervalMs,
  pickCue,
  type SchedulerState,
} from './CueScheduler';

export interface SchedulerSnapshot {
  pickState: SchedulerState;
  nextCueAtDrillMs: DrillMs;
  cuesFired: number;
}

export function createInitialSchedulerSnapshot(
  config: DrillConfig,
  rng: Rng,
): SchedulerSnapshot {
  return {
    pickState: initialSchedulerState(),
    // First cue after a random interval from drill start (not at t=0).
    nextCueAtDrillMs: nextIntervalMs(rng, config),
    cuesFired: 0,
  };
}

export function shouldFireCue(
  snapshot: SchedulerSnapshot,
  drillNowMs: DrillMs,
  durationMs: number,
): boolean {
  if (drillNowMs >= durationMs) return false;
  return drillNowMs >= snapshot.nextCueAtDrillMs;
}

export interface FireCueResult {
  cue: CueDefinition;
  /** Resolved spoken / HUD phrase for this firing (pre mode-resolve). */
  phrase: string;
  event: CueEvent;
  snapshot: SchedulerSnapshot;
  /** CueScheduler pick payload for mode resolveCue. */
  picked: ReturnType<typeof pickCue>;
  /** Scheduler state before this pick (for mode avoid-repeat). */
  priorState: SchedulerState;
}

/**
 * Pick + record a cue at the given dual-clock onset; schedule the next interval.
 * Pure — no audio / React. Mode resolveCue may still rewrite the phrase after.
 */
export function fireCueAt(args: {
  config: DrillConfig;
  snapshot: SchedulerSnapshot;
  onsetDrillMs: DrillMs;
  onsetWallMs: WallMs;
  random: Rng;
  id: string;
  /**
   * Minimum gap before the next cue (ms), typically estimated TTS length + pad.
   * Applied after the random interval sample. Prefer post-resolve phrase from the store.
   */
  intervalFloorMs?: number | ((phrase: string) => number);
}): FireCueResult {
  const { config, snapshot, onsetDrillMs, onsetWallMs, random, id } = args;

  const priorState = snapshot.pickState;
  const picked = pickCue(random, config, priorState);
  const cue = getCueDefinition(picked.cue.cueId);
  const phrase = picked.cue.phrase;
  const index = snapshot.cuesFired;

  const event: CueEvent = {
    id,
    cueId: cue.id,
    index,
    phrase,
    onsetWallMs,
    onsetDrillMs,
    plannedOffsetMs: snapshot.nextCueAtDrillMs,
    verification: null,
  };

  const floor =
    typeof args.intervalFloorMs === 'function'
      ? args.intervalFloorMs(phrase)
      : (args.intervalFloorMs ?? 0);

  const interval = nextIntervalMs(random, config, floor);

  const next: SchedulerSnapshot = {
    pickState: picked.nextState,
    nextCueAtDrillMs: onsetDrillMs + interval,
    cuesFired: snapshot.cuesFired + 1,
  };

  return { cue, phrase, event, snapshot: next, picked, priorState };
}

export function remainingDrillMs(
  durationMs: number,
  drillNowMs: DrillMs,
): number {
  return Math.max(0, durationMs - drillNowMs);
}
