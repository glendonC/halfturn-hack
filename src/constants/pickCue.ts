import type { CueType } from '@/types';

import { isDirectionalCheck } from './cues';
import { clampLeftRightBalance } from './defaults';

export type RandomFn = () => number;

export interface PickNextCueArgs {
  enabled: readonly CueType[];
  /** Recent cue types, newest last — used for repeat avoidance */
  recent: readonly CueType[];
  /** Target P(left | directional check), 0–1 */
  leftRightBalance: number;
  /** Session counts of directional checks so far */
  leftCount: number;
  rightCount: number;
  /** Avoid repeating the last N cues when alternatives exist (default 1) */
  avoidLastN?: number;
  /** Injected RNG in [0, 1); defaults to Math.random */
  random?: RandomFn;
}

/**
 * Probability of picking left when both directional checks are eligible.
 * With history, pulls toward the underrepresented side vs target share.
 */
export function directionalLeftProbability(args: {
  leftCount: number;
  rightCount: number;
  leftRightBalance: number;
}): number {
  const targetLeft = clampLeftRightBalance(args.leftRightBalance);
  const total = args.leftCount + args.rightCount;
  if (total <= 0) return targetLeft;

  const currentLeftShare = args.leftCount / total;
  const leftNeed = Math.max(0, targetLeft - currentLeftShare);
  const rightNeed = Math.max(0, currentLeftShare - targetLeft);
  if (leftNeed === 0 && rightNeed === 0) return targetLeft;

  const corrective = leftNeed / (leftNeed + rightNeed);
  return 0.65 * corrective + 0.35 * targetLeft;
}

export function pickDirectionalCheck(args: {
  options: readonly CueType[];
  leftCount: number;
  rightCount: number;
  leftRightBalance: number;
  random: RandomFn;
}): CueType {
  const { options, leftCount, rightCount, random } = args;
  const leftRightBalance = clampLeftRightBalance(args.leftRightBalance);
  const hasLeft = options.includes('check_left');
  const hasRight = options.includes('check_right');

  if (hasLeft && !hasRight) return 'check_left';
  if (hasRight && !hasLeft) return 'check_right';
  if (!hasLeft && !hasRight) {
    const index = Math.min(
      options.length - 1,
      Math.floor(random() * options.length),
    );
    return options[index]!;
  }

  const pLeft = directionalLeftProbability({
    leftCount,
    rightCount,
    leftRightBalance,
  });
  return random() < pLeft ? 'check_left' : 'check_right';
}

function weightForCue(
  cue: CueType,
  args: {
    leftCount: number;
    rightCount: number;
    leftRightBalance: number;
    pool: readonly CueType[];
  },
): number {
  if (!isDirectionalCheck(cue)) return 1;

  const hasBoth =
    args.pool.includes('check_left') && args.pool.includes('check_right');
  if (!hasBoth) return 1;

  const pLeft = directionalLeftProbability({
    leftCount: args.leftCount,
    rightCount: args.rightCount,
    leftRightBalance: args.leftRightBalance,
  });

  // Keep combined L+R mass ≈ two unit cues; redistribute toward target balance.
  return cue === 'check_left' ? 2 * pLeft : 2 * (1 - pLeft);
}

/**
 * Pick the next cue with:
 * 1. Repeat avoidance (skip last N when alternatives exist)
 * 2. L/R balance pressure on directional checks toward leftRightBalance
 *
 * Pure / unit-testable — no React Native imports.
 */
export function pickNextCue(args: PickNextCueArgs): CueType {
  const {
    enabled,
    recent,
    leftCount,
    rightCount,
    avoidLastN = 1,
    random = Math.random,
  } = args;
  const leftRightBalance = clampLeftRightBalance(args.leftRightBalance);

  if (enabled.length === 0) {
    throw new Error('pickNextCue: enabled cue list is empty');
  }

  const recentSlice = recent.slice(-Math.max(0, avoidLastN));
  const nonRepeats = enabled.filter((c) => !recentSlice.includes(c));
  const pool = nonRepeats.length > 0 ? nonRepeats : [...enabled];

  const weights = pool.map((cue) =>
    weightForCue(cue, { leftCount, rightCount, leftRightBalance, pool }),
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let ticket = random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    ticket -= weights[i]!;
    if (ticket < 0) return pool[i]!;
  }

  return pool[pool.length - 1]!;
}
