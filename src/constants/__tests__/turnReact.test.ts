import { CUES } from '@/constants/cues';
import { mulberry32 } from '@/utils/random';
import {
  TURN_REACT_COLORS,
  TURN_REACT_CUE_FLOODS,
  getTurnReactColor,
  pickTurnReactColor,
} from '../turnReact';

describe('turn-react color palette', () => {
  it('excludes White and Black (unreadable as a full-screen flood)', () => {
    const names = TURN_REACT_COLORS.map((c) => c.name.toLowerCase());
    expect(names).not.toContain('white');
    expect(names).not.toContain('black');
    expect(TURN_REACT_COLORS.length).toBeGreaterThan(0);
  });

  it('every entry has a flood + an auto-contrast text color', () => {
    for (const c of TURN_REACT_COLORS) {
      expect(c.flood).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('resolves a name back to its colors, case-insensitively', () => {
    const blue = getTurnReactColor('blue');
    expect(blue?.name).toBe('Blue');
    expect(getTurnReactColor('  RED ')?.name).toBe('Red');
  });

  it('returns undefined for unknown / empty names', () => {
    expect(getTurnReactColor('chartreuse')).toBeUndefined();
    expect(getTurnReactColor(undefined)).toBeUndefined();
    expect(getTurnReactColor(null)).toBeUndefined();
    expect(getTurnReactColor('')).toBeUndefined();
  });

  it('pickTurnReactColor returns a palette member', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i += 1) {
      expect(TURN_REACT_COLORS).toContain(pickTurnReactColor(rng));
    }
  });
});

describe('turn-react cue floods', () => {
  it('covers every colorToken in the cue catalog with a flood/text pair', () => {
    for (const cue of Object.values(CUES)) {
      const pair = TURN_REACT_CUE_FLOODS[cue.colorToken];
      expect(pair).toBeDefined();
      expect(pair.flood).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(pair.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
