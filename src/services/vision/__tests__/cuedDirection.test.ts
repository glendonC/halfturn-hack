import type { CueEvent, Side } from '@/types';

import { computeCuedDirectionAccuracy, computeScanVerification, detectScans } from '../scanDetect';
import { DEFAULT_SCAN_DETECT_CONFIG, type PoseSample, type ScanEvent } from '../types';

/**
 * Cued-turn scoring: the drill's own `check_left` / `check_right` cue tells the player which
 * way to turn, so the cue's `side` is a free ground-truth label. These tests pin the pairing
 * rules (one-to-one, forward window, directional cues only) with literal known answers.
 */

let seq = 0;
function cue(side: Side, firedAtMonoMs: number): CueEvent {
  const directional = side === 'left' || side === 'right';
  return {
    seq: seq++,
    cueId: directional ? (side === 'left' ? 'check_left' : 'check_right') : 'color',
    category: directional ? 'direction' : 'variable',
    phrase: directional ? `Check ${side}` : 'Red',
    side,
    firedAtMonoMs,
    firedAtEpochMs: 1_700_000_000_000 + firedAtMonoMs,
    plannedOffsetMs: firedAtMonoMs,
  };
}

/** A detected turn at `tMonoMs` (the peak, which is what cue pairing keys on). */
function scan(direction: 'left' | 'right', tMonoMs: number): ScanEvent {
  return { tMonoMs, direction, peakYawDeg: direction === 'left' ? -45 : 45 };
}

beforeEach(() => {
  seq = 0;
});

describe('computeCuedDirectionAccuracy', () => {
  it('scores a turn that matches its cued side as correct', () => {
    const cues = [cue('left', 1000), cue('right', 4000)];
    const scans = [scan('left', 1400), scan('right', 4400)];
    const r = computeCuedDirectionAccuracy(scans, cues);
    expect(r).toEqual({ cuedTurns: 2, matched: 2, correct: 2, accuracy: 1, recall: 1 });
  });

  it('counts a turn the WRONG way as matched but incorrect', () => {
    const cues = [cue('left', 1000), cue('right', 4000)];
    const scans = [scan('right', 1400), scan('right', 4400)];
    const r = computeCuedDirectionAccuracy(scans, cues);
    expect(r.matched).toBe(2);
    expect(r.correct).toBe(1);
    expect(r.accuracy).toBe(0.5);
  });

  it('counts a cue with no turn in its window as a recall miss, not a wrong direction', () => {
    const cues = [cue('left', 1000), cue('right', 4000)];
    const scans = [scan('left', 1400)]; // the player never answered the second cue
    const r = computeCuedDirectionAccuracy(scans, cues);
    expect(r).toEqual({ cuedTurns: 2, matched: 1, correct: 1, accuracy: 1, recall: 0.5 });
  });

  it('ignores a turn outside the forward window', () => {
    // scanBeforeWindowMs is 2500 by default; this turn lands 3s after the cue.
    const cues = [cue('left', 1000)];
    const r = computeCuedDirectionAccuracy([scan('left', 4000)], cues);
    expect(r).toEqual({ cuedTurns: 1, matched: 0, correct: 0, accuracy: null, recall: 0 });
  });

  it('ignores a turn that PRECEDES its cue (a gun-jumped turn answers nothing)', () => {
    const cues = [cue('left', 1000)];
    const r = computeCuedDirectionAccuracy([scan('left', 900)], cues);
    expect(r.matched).toBe(0);
  });

  it('never lets two close cues both claim one physical turn', () => {
    // Both cues are within window of the single turn. One-to-one pairing means exactly one
    // match (the nearer cue, lag 100 < 300) and the other cue is a recall miss — NOT two
    // matches off one turn, which would inflate both recall and the denominator.
    // Same side on both cues so the count property is isolated from direction scoring.
    const cues = [cue('left', 1000), cue('left', 1200)];
    const r = computeCuedDirectionAccuracy([scan('left', 1300)], cues);
    expect(r).toEqual({ cuedTurns: 2, matched: 1, correct: 1, accuracy: 1, recall: 0.5 });
  });

  it('pairs each cue to its nearest following turn (greedy by lag)', () => {
    const cues = [cue('left', 1000)];
    // Two turns in window; the nearer one (lag 200) is the answer to the cue.
    const r = computeCuedDirectionAccuracy([scan('left', 1200), scan('right', 2000)], cues);
    expect(r.matched).toBe(1);
    expect(r.correct).toBe(1);
  });

  it('ignores non-directional cues entirely (they carry no ground truth)', () => {
    // color/number cues are `side: 'none'` — they say nothing about which way to turn.
    const cues = [cue('none', 1000), cue('none', 4000)];
    const r = computeCuedDirectionAccuracy([scan('left', 1400)], cues);
    expect(r).toEqual({ cuedTurns: 0, matched: 0, correct: 0, accuracy: null, recall: null });
  });
});

describe('computeScanVerification — turnDirectionAccuracy', () => {
  const leftTrace: PoseSample[] = [0, 0, -30, -40, -45, -40, -30, -10, 0].map((yawDeg, i) => ({
    tMonoMs: 1000 + i * 33,
    yawDeg,
    confidence: 0.9,
  }));

  it('populates the metric when the session fired directional cues', () => {
    const scans = detectScans(leftTrace);
    const v = computeScanVerification(scans, [cue('left', 950)], 60, 'test', DEFAULT_SCAN_DETECT_CONFIG);
    expect(v.turnDirectionAccuracy).toBe(1);
  });

  it('leaves the key ABSENT when no directional cues fired', () => {
    // A color/number-only run has no ground truth, so the field must not appear at all —
    // absent (not null) keeps such sessions byte-identical to before the metric existed,
    // which is what the golden fixtures pin.
    const scans = detectScans(leftTrace);
    const v = computeScanVerification(scans, [cue('none', 950)], 60, 'test', DEFAULT_SCAN_DETECT_CONFIG);
    expect('turnDirectionAccuracy' in v).toBe(false);
  });
});
