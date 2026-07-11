const mockPlayBeep = jest.fn();
const mockPrimeBeep = jest.fn();

jest.mock('@/services/audio', () => ({
  __esModule: true,
  playBeep: (...args: unknown[]) => mockPlayBeep(...args),
  primeBeep: (...args: unknown[]) => mockPrimeBeep(...args),
  phraseToSpeakVars: (cueId: string, phrase: string) => {
    if (cueId === 'color') return { color: phrase };
    if (cueId === 'number') return { number: phrase };
    return undefined;
  },
}));

import { REVEAL_PAD_MS, REVEAL_WINDOW_MS, TURN_REACT_COLORS } from '@/constants/turnReact';
import type { AudioCueEngine } from '@/services/audio';
import type { DrillConfig } from '@/types';
import { initialSchedulerState } from '../../CueScheduler';

import { getDrillModeBehavior, MODE_LAYOUT } from '../index';
import type { PickedCue } from '../types';

const CONFIG = { avoidLastN: 1 } as unknown as DrillConfig;
const PRIOR = initialSchedulerState();

function fakeEngine(estimate = 800): AudioCueEngine & {
  spoken: string[];
} {
  const spoken: string[] = [];
  return {
    spoken,
    async prepare() {},
    async speak(text) {
      spoken.push(text);
    },
    async stop() {},
    estimateMs: () => estimate,
  };
}

function pickedOf(
  cueId: 'scan' | 'color' | 'turn',
  phrase: string,
): PickedCue {
  return {
    cue: { cueId, side: 'none', phrase },
    nextState: { lastCueId: cueId, lastPhrase: phrase },
  };
}

beforeEach(() => {
  mockPlayBeep.mockClear();
  mockPrimeBeep.mockClear();
});

describe('getDrillModeBehavior', () => {
  it('maps each mode to its behavior', () => {
    expect(getDrillModeBehavior('audio').mode).toBe('audio');
    expect(getDrillModeBehavior('turn_react').mode).toBe('turn_react');
  });
});

describe('MODE_LAYOUT', () => {
  it('is the single source of truth for mode → layout', () => {
    expect(MODE_LAYOUT.audio).toBe('audio-hud');
    expect(MODE_LAYOUT.turn_react).toBe('turn-react-surface');
  });
});

describe('AudioDrillBehavior', () => {
  const b = getDrillModeBehavior('audio');

  it('passes the picked cue through unchanged', () => {
    const picked = pickedOf('scan', 'Scan');
    const r = b.resolveCue(picked, () => 0, CONFIG, PRIOR);
    expect(r.phrase).toBe('Scan');
    expect(r.nextState.lastCueId).toBe('scan');
  });

  it('speaks the phrase (no beep) and floors at utterance length + pad', () => {
    const engine = fakeEngine(800);
    b.presentCue('Scan', engine);
    expect(engine.spoken).toEqual(['Scan']);
    expect(mockPlayBeep).not.toHaveBeenCalled();
    expect(b.minIntervalFloorMs('Scan', engine)).toBe(1050);
  });

  it('prepareAudio is a no-op and resolves NullPoseVerifier', async () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).not.toHaveBeenCalled();
    const v = b.resolveVerifier();
    expect(v.available).toBe(false);
    await expect(v.stop()).resolves.toEqual([]);
  });
});

describe('TurnReactDrillBehavior', () => {
  const b = getDrillModeBehavior('turn_react');
  const names = TURN_REACT_COLORS.map((c) => c.name);

  it('passes non-color cues through unchanged', () => {
    const picked = pickedOf('scan', 'Scan');
    const r = b.resolveCue(picked, () => 0, CONFIG, PRIOR);
    expect(r.phrase).toBe('Scan');
  });

  it('re-rolls the color cue from the readable turn-react palette', () => {
    const picked = pickedOf('color', 'White');
    const r = b.resolveCue(picked, () => 0, CONFIG, PRIOR);
    expect(names).toContain(r.phrase);
    expect(r.phrase).not.toBe('White');
  });

  it('honors avoidLastN against the prior phrase', () => {
    const values = [0, 0.99];
    let i = 0;
    const rng = () => values[i++ % values.length]!;
    const prior = {
      lastCueId: 'color' as const,
      lastPhrase: TURN_REACT_COLORS[0]!.name,
    };
    const r = b.resolveCue(pickedOf('color', 'Red'), rng, CONFIG, prior);
    expect(r.phrase).not.toBe(TURN_REACT_COLORS[0]!.name);
    expect(names).toContain(r.phrase);
  });

  it('allows a repeat when avoidLastN is 0', () => {
    const cfg = { avoidLastN: 0 } as unknown as DrillConfig;
    const prior = {
      lastCueId: 'color' as const,
      lastPhrase: TURN_REACT_COLORS[0]!.name,
    };
    const r = b.resolveCue(
      pickedOf('color', 'Red'),
      () => 0,
      cfg,
      prior,
    );
    expect(r.phrase).toBe(TURN_REACT_COLORS[0]!.name);
  });

  it('plays a beep (never speaks) and floors at reveal window + pad', () => {
    const engine = fakeEngine(800);
    b.presentCue('Blue', engine);
    expect(mockPlayBeep).toHaveBeenCalledTimes(1);
    expect(engine.spoken).toEqual([]);
    expect(b.minIntervalFloorMs('Blue', engine)).toBe(
      REVEAL_WINDOW_MS + REVEAL_PAD_MS,
    );
  });

  it('primes the beep and resolves NullPoseVerifier', async () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).toHaveBeenCalledTimes(1);
    const v = b.resolveVerifier();
    expect(v.available).toBe(false);
    await expect(v.stop()).resolves.toEqual([]);
  });
});
