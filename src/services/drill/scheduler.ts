import {
  getCueDefinition,
  isDirectionalCheck,
  pickNextCue,
  resolveCuePhrase,
} from '@/constants';
import type {
  CueDefinition,
  CueEvent,
  CueType,
  DrillConfig,
  DrillMs,
  WallMs,
} from '@/types';

import { pickIntervalMs } from './pickInterval';

export interface SchedulerSnapshot {
  recentCueTypes: CueType[];
  leftCount: number;
  rightCount: number;
  nextCueAtDrillMs: DrillMs;
  cuesFired: number;
}

export function createInitialSchedulerSnapshot(
  config: DrillConfig,
  random: () => number,
): SchedulerSnapshot {
  return {
    recentCueTypes: [],
    leftCount: 0,
    rightCount: 0,
    // First cue after a random interval from drill start (not at t=0).
    nextCueAtDrillMs: pickIntervalMs(
      config.intervalMs.min,
      config.intervalMs.max,
      random,
    ),
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
  /** Resolved spoken / HUD phrase for this firing */
  phrase: string;
  event: CueEvent;
  snapshot: SchedulerSnapshot;
}

/**
 * Pick + record a cue at the given dual-clock onset; schedule the next interval.
 * Pure — no audio / React. Variable cues resolve phrase via rng here.
 */
export function fireCueAt(args: {
  config: DrillConfig;
  snapshot: SchedulerSnapshot;
  onsetDrillMs: DrillMs;
  onsetWallMs: WallMs;
  random: () => number;
  id: string;
  /**
   * Minimum gap before the next cue (ms), typically estimated TTS length + pad.
   * Applied after the random interval sample.
   */
  intervalFloorMs?: number | ((phrase: string) => number);
}): FireCueResult {
  const { config, snapshot, onsetDrillMs, onsetWallMs, random, id } = args;

  const cueType = pickNextCue({
    enabled: config.enabledCues,
    recent: snapshot.recentCueTypes,
    leftRightBalance: config.leftRightBalance,
    leftCount: snapshot.leftCount,
    rightCount: snapshot.rightCount,
    random,
  });

  const cue = getCueDefinition(cueType);
  const phrase = resolveCuePhrase(cueType, random);
  const index = snapshot.cuesFired;

  const event: CueEvent = {
    id,
    cueId: cue.id,
    index,
    phrase,
    onsetWallMs,
    onsetDrillMs,
    // Intent at fire time: when the scheduler meant this cue to land.
    plannedOffsetMs: snapshot.nextCueAtDrillMs,
    verification: null,
  };

  const recentCueTypes = [...snapshot.recentCueTypes, cueType].slice(-5);
  let leftCount = snapshot.leftCount;
  let rightCount = snapshot.rightCount;
  if (isDirectionalCheck(cueType)) {
    if (cueType === 'check_left') leftCount += 1;
    else rightCount += 1;
  }

  const floor =
    typeof args.intervalFloorMs === 'function'
      ? args.intervalFloorMs(phrase)
      : (args.intervalFloorMs ?? 0);

  const interval = pickIntervalMs(
    config.intervalMs.min,
    config.intervalMs.max,
    random,
    floor,
  );

  const next: SchedulerSnapshot = {
    recentCueTypes,
    leftCount,
    rightCount,
    nextCueAtDrillMs: onsetDrillMs + interval,
    cuesFired: snapshot.cuesFired + 1,
  };

  return { cue, phrase, event, snapshot: next };
}

export function remainingDrillMs(
  durationMs: number,
  drillNowMs: DrillMs,
): number {
  return Math.max(0, durationMs - drillNowMs);
}
