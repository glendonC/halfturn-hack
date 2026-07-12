/**
 * Turn-and-react camera-mode presentation constants.
 *
 * In turn-react mode the full screen floods with a color and shows the value the
 * player must read after half-turning. Unlike the audio drill, the value
 * is information, so the flood PERSISTS for a reveal window instead of fading,
 * and the palette deliberately EXCLUDES White/Black — they are unreadable as a
 * full-screen flood (white-on-white / black-on-black). Each entry pairs a flood
 * color with an auto-contrast text color; the spoken value is suppressed in this
 * mode (a beep is the reaction anchor), so the on-screen color IS the cue.
 */

import { pick, type Rng } from '@/utils/random';

/** How long the value/flood stays on screen after a cue before snapping neutral. */
export const REVEAL_WINDOW_MS = 1500;

export interface TurnReactColor {
  /** Display + (suppressed) spoken name, e.g. "Blue". Also the CueEvent.phrase. */
  name: string;
  /** Full-screen flood color. */
  flood: string;
  /** Auto-contrast color for the word drawn on the flood. */
  text: string;
}

/**
 * Readable-at-distance flood palette. No White/Black (see file header). Names
 * stay short + unambiguous; the word itself is the colorblind-redundant coding.
 */
export const TURN_REACT_COLORS: readonly TurnReactColor[] = [
  { name: 'Red', flood: '#E23B3B', text: '#FFFFFF' },
  { name: 'Blue', flood: '#2F6BFF', text: '#FFFFFF' },
  { name: 'Green', flood: '#1FB84D', text: '#08130B' },
  { name: 'Yellow', flood: '#FFD60A', text: '#1A1500' },
  { name: 'Orange', flood: '#FF8C1A', text: '#1A0E00' },
  { name: 'Purple', flood: '#9B5DE5', text: '#FFFFFF' },
] as const;

/**
 * Flood/text pairs for the NON-variable cues, keyed by the cue's `colorToken`.
 * Hues match the app-wide cue coding (setup chips, history) so the meaning a
 * player learns between drills holds on the field; text is auto-contrast ink
 * picked per flood, exactly like TURN_REACT_COLORS. Defined here (not read from
 * the dark theme) so the cue surface has no dark-token dependency.
 */
export const TURN_REACT_CUE_FLOODS: Record<string, TurnReactColor> = {
  cueLeft: { name: 'Left', flood: '#22D3EE', text: '#062A31' },
  cueRight: { name: 'Right', flood: '#FB923C', text: '#331302' },
  cueAction: { name: 'Action', flood: '#A3E635', text: '#1A2404' },
  cueAlert: { name: 'Alert', flood: '#FB7185', text: '#38040E' },
  cueVariableColor: { name: 'Color', flood: '#C084FC', text: '#22083D' },
  cueVariableNumber: { name: 'Number', flood: '#FACC15', text: '#1A1500' },
};

/** Pick a random turn-react color (used to resolve the `color` cue in this mode). */
export function pickTurnReactColor(rng: Rng): TurnReactColor {
  return pick(rng, TURN_REACT_COLORS);
}

/** Resolve a color name (a CueEvent.phrase) back to its flood/text colors. */
export function getTurnReactColor(name: string | null | undefined): TurnReactColor | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return TURN_REACT_COLORS.find((c) => c.name.toLowerCase() === key);
}
