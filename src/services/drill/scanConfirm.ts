/**
 * The live confirm rule: does a camera-detected turn answer the cue that is on screen?
 *
 * Pure + dependency-free (structural param types) so the rule is unit-testable without the
 * engine, the camera, or a device — same discipline as CueScheduler and scanDetect. The drill
 * engine consults it from the verifier's `onScan` callback to close the cue → turn → confirm
 * loop (ding + haptic + the N/M ✓ tally).
 */

import type { Side } from '@/types';

/** One camera-detected turn, reduced to what the confirm rule needs. */
export interface ConfirmableScan {
  /** Drill-clock ms at the yaw peak. */
  tMonoMs: number;
  direction: 'left' | 'right';
}

/** The cue being answered, reduced to what the confirm rule needs. */
export interface ConfirmableCue {
  /** Drill-clock ms the cue fired. */
  firedAtMonoMs: number;
  side: Side;
}

/**
 * True when a cue names a side the player must turn toward.
 *
 * ⚠️ `Side` is `'left' | 'right' | 'none'`, so a plain truthiness test on `cue.side` is a TRAP:
 * `'none'` is a non-empty string and therefore truthy. Six of the eight cues (`color`, `number`,
 * `turn`, `scan`, `man_on`, `open_body`) are `side: 'none'`, and `color`/`number` are exactly the
 * cues Turn & React uses as its information channel — so a truthiness test silently rejects every
 * confirm in the mode's primary configuration.
 */
export function isDirectionalCue(side: Side): side is 'left' | 'right' {
  return side === 'left' || side === 'right';
}

/**
 * Whether a detected turn confirms the cue that is currently showing.
 *
 * - A turn whose peak PRECEDES the cue answers nothing (the player was already turning).
 * - A DIRECTIONAL cue (`check_left` / `check_right`) additionally demands the cued side: turning
 *   the wrong way is not a confirm.
 * - A NON-directional cue (color / number / turn / …) only asks the player to look at the screen,
 *   so a turn either way answers it.
 */
export function scanConfirmsCue(scan: ConfirmableScan, cue: ConfirmableCue): boolean {
  if (scan.tMonoMs < cue.firedAtMonoMs) return false;
  if (isDirectionalCue(cue.side)) return scan.direction === cue.side;
  return true;
}
