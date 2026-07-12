import { CUES, ALL_CUE_IDS } from '@/constants/cues';

import { isDirectionalCue, scanConfirmsCue } from '../scanConfirm';

const scan = (tMonoMs: number, direction: 'left' | 'right') => ({ tMonoMs, direction });
const cue = (firedAtMonoMs: number, side: 'left' | 'right' | 'none') => ({ firedAtMonoMs, side });

describe('isDirectionalCue', () => {
  it("treats 'none' as NOT directional", () => {
    // The whole bug in one assertion: `'none'` is a truthy string, so `if (cue.side)` passes
    // for it. Every non-directional cue must fail this predicate.
    expect(isDirectionalCue('none')).toBe(false);
    expect(isDirectionalCue('left')).toBe(true);
    expect(isDirectionalCue('right')).toBe(true);
  });
});

describe('scanConfirmsCue — directional cues', () => {
  it('confirms a turn toward the cued side', () => {
    expect(scanConfirmsCue(scan(1400, 'left'), cue(1000, 'left'))).toBe(true);
    expect(scanConfirmsCue(scan(1400, 'right'), cue(1000, 'right'))).toBe(true);
  });

  it('rejects a turn the wrong way', () => {
    expect(scanConfirmsCue(scan(1400, 'right'), cue(1000, 'left'))).toBe(false);
    expect(scanConfirmsCue(scan(1400, 'left'), cue(1000, 'right'))).toBe(false);
  });
});

describe('scanConfirmsCue — non-directional cues (the regression)', () => {
  it('confirms a turn EITHER way on a color cue', () => {
    // color/number only ask the player to look at the screen — the side is not part of the
    // task, so both directions answer it. Before the fix these could never be confirmed
    // (`'none'` is truthy, so the side-match guard rejected every scan), which meant the
    // N/M ✓ tally read 0 and the "Good" confirm never fired in Turn & React's primary setup.
    expect(scanConfirmsCue(scan(1400, 'left'), cue(1000, 'none'))).toBe(true);
    expect(scanConfirmsCue(scan(1400, 'right'), cue(1000, 'none'))).toBe(true);
  });

  it('confirms a turn on every non-directional cue in the catalog', () => {
    const nonDirectional = ALL_CUE_IDS.filter((id) => CUES[id].side === 'none');
    // Guards the premise: if the catalog ever loses its non-directional cues this test is vacuous.
    expect(nonDirectional.length).toBeGreaterThan(0);
    for (const id of nonDirectional) {
      expect(scanConfirmsCue(scan(1400, 'left'), cue(1000, CUES[id].side))).toBe(true);
    }
  });
});

describe('scanConfirmsCue — timing', () => {
  it('rejects a turn whose peak precedes the cue (the player was already turning)', () => {
    expect(scanConfirmsCue(scan(900, 'left'), cue(1000, 'left'))).toBe(false);
    expect(scanConfirmsCue(scan(900, 'left'), cue(1000, 'none'))).toBe(false);
  });

  it('accepts a turn peaking exactly at the cue instant', () => {
    expect(scanConfirmsCue(scan(1000, 'left'), cue(1000, 'left'))).toBe(true);
  });
});
