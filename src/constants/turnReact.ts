/**
 * Turn-and-react presentation constants.
 *
 * The full screen floods with a color and shows the value the player must read
 * after half-turning. The flood PERSISTS for a reveal window (not a fade), and
 * the palette deliberately EXCLUDES White/Black — unreadable as full-screen
 * floods. Spoken value is suppressed (beep is the reaction anchor).
 */

import { pick } from '@/utils/rng';

/** How long the value/flood stays on screen after a cue before snapping neutral. */
export const REVEAL_WINDOW_MS = 1500;
export const REVEAL_PAD_MS = 250;

export interface TurnReactColor {
  /** Display name / CueEvent.phrase, e.g. "Blue". */
  name: string;
  /** Full-screen flood color. */
  flood: string;
  /** Auto-contrast color for the word drawn on the flood. */
  text: string;
}

/**
 * Readable-at-distance flood palette. No White/Black.
 * The word itself is the colorblind-redundant coding.
 */
export const TURN_REACT_COLORS: readonly TurnReactColor[] = [
  { name: 'Red', flood: '#E23B3B', text: '#FFFFFF' },
  { name: 'Blue', flood: '#2F6BFF', text: '#FFFFFF' },
  { name: 'Green', flood: '#1FB84D', text: '#08130B' },
  { name: 'Yellow', flood: '#FFD60A', text: '#1A1500' },
  { name: 'Orange', flood: '#FF8C1A', text: '#1A0E00' },
  { name: 'Purple', flood: '#9B5DE5', text: '#FFFFFF' },
] as const;

/** Neutral plate for number cues — the digit is the signal, not the flood. */
export const TURN_REACT_NUMBER_PLATE = {
  flood: '#1A3D32',
  text: '#F2F7F4',
} as const;

/** Pick a random turn-react color (resolves the `color` cue in this mode). */
export function pickTurnReactColor(rng: () => number): TurnReactColor {
  return pick(rng, TURN_REACT_COLORS);
}

/** Resolve a color name (CueEvent.phrase) back to its flood/text colors. */
export function getTurnReactColor(
  name: string | null | undefined,
): TurnReactColor | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return TURN_REACT_COLORS.find((c) => c.name.toLowerCase() === key);
}
