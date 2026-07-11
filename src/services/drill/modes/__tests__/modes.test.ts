/**
 * Mode-strategy tests. The audio + vision modules are mocked so this stays a
 * pure-logic unit test (no Expo native import chain) — it exercises the cue
 * resolution, interval floors, audio presentation, and verifier selection that
 * the engine delegates, without a device.
 */

// `mock`-prefixed so jest's mock-factory hoisting guard allows the references.
const mockPlayBeep = jest.fn();
const mockPrimeBeep = jest.fn();
const mockGetPoseVerifierAsync = jest.fn(async () => ({
  available: true,
  engine: 'mock@1',
  start() {},
  async stop() {
    return [];
  },
}));

jest.mock('@/services/audio', () => ({
  __esModule: true,
  playBeep: (...args: unknown[]) => mockPlayBeep(...args),
  primeBeep: (...args: unknown[]) => mockPrimeBeep(...args),
}));

jest.mock('@/services/vision', () => ({
  __esModule: true,
  NullPoseVerifier: class NullPoseVerifier {
    available = false;
    start() {}
    async stop() {
      return [];
    }
  },
  getPoseVerifierAsync: (...args: unknown[]) => mockGetPoseVerifierAsync(...(args as [])),
}));

import { REVEAL_WINDOW_MS, TURN_REACT_COLORS } from '@/constants/turnReact';
import type { AudioCueEngine } from '@/services/audio';
import type { DrillConfig } from '@/types';
import type { PickedCue } from '../types';
import { getDrillModeBehavior, MODE_LAYOUT } from '../index';

const CONFIG = { avoidImmediateRepeat: true } as unknown as DrillConfig;

/** A scripted RNG returning the given [0,1) values in order (then repeats). */
function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Fake audio engine that records speak() and returns a fixed estimate. */
function fakeEngine(estimate = 800): AudioCueEngine & { spoken: string[] } {
  const spoken: string[] = [];
  return {
    spoken,
    async prepare() {},
    async speak(phrase: string) {
      spoken.push(phrase);
    },
    estimateMs: () => estimate,
    async stop() {},
  };
}

function pickedOf(cueId: string, phrase: string): PickedCue {
  return {
    cue: { cueId: cueId as never, side: 'none', phrase },
    nextState: { lastCueId: cueId as never, lastPhrase: phrase },
  };
}

beforeEach(() => {
  mockPlayBeep.mockClear();
  mockPrimeBeep.mockClear();
  mockGetPoseVerifierAsync.mockClear();
});

describe('getDrillModeBehavior', () => {
  it('maps each mode to its behavior', () => {
    expect(getDrillModeBehavior('audio').mode).toBe('audio');
    expect(getDrillModeBehavior('turn-react').mode).toBe('turn-react');
  });
});

describe('MODE_LAYOUT', () => {
  it('is the single source of truth for mode → layout', () => {
    expect(MODE_LAYOUT.audio).toBe('audio-hud');
    expect(MODE_LAYOUT['turn-react']).toBe('turn-react-facetime');
  });
});

describe('AudioDrillBehavior', () => {
  const b = getDrillModeBehavior('audio');

  it('passes the picked cue through unchanged', () => {
    const picked = pickedOf('scan', 'Scan');
    const r = b.resolveCue(picked, scriptedRng([0]), CONFIG, picked.nextState);
    expect(r.phrase).toBe('Scan');
    expect(r.nextState).toBe(picked.nextState);
  });

  it('speaks the phrase (no beep) and floors at utterance length + pad', () => {
    const engine = fakeEngine(800);
    b.presentCue('Man on', engine);
    expect(engine.spoken).toEqual(['Man on']);
    expect(mockPlayBeep).not.toHaveBeenCalled();
    expect(b.minIntervalFloorMs('Man on', engine)).toBe(1050); // 800 + 250
  });

  it('prepareAudio is a no-op and resolves the no-op verifier', async () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).not.toHaveBeenCalled();
    const v = await b.resolveVerifier();
    expect(v.available).toBe(false);
  });
});

describe('TurnReactDrillBehavior', () => {
  const b = getDrillModeBehavior('turn-react');
  const names = TURN_REACT_COLORS.map((c) => c.name);

  it('passes non-color cues through unchanged', () => {
    const picked = pickedOf('turn', 'Turn');
    const r = b.resolveCue(picked, scriptedRng([0]), CONFIG, picked.nextState);
    expect(r.phrase).toBe('Turn');
  });

  it('re-rolls the color cue from the readable turn-react palette', () => {
    // rng 0 → index 0 (Red); the spoken palette phrase "White" is discarded.
    const picked = pickedOf('color', 'White');
    const r = b.resolveCue(picked, scriptedRng([0]), CONFIG, { lastCueId: null, lastPhrase: null });
    expect(names).toContain(r.phrase);
    expect(r.phrase).not.toBe('White');
    expect(r.nextState.lastPhrase).toBe(r.phrase);
  });

  it('honors avoid-immediate-repeat against the prior phrase', () => {
    // First roll → index 0 = Red (repeats prior); re-roll → index 5 = Purple.
    const rng = scriptedRng([0, 0.99]);
    const prior = { lastCueId: 'color' as never, lastPhrase: TURN_REACT_COLORS[0].name };
    const r = b.resolveCue(pickedOf('color', 'Red'), rng, CONFIG, prior);
    expect(r.phrase).not.toBe(TURN_REACT_COLORS[0].name);
    expect(names).toContain(r.phrase);
  });

  it('allows a repeat when avoid-immediate-repeat is off', () => {
    const rng = scriptedRng([0]); // index 0 = Red, no re-roll
    const prior = { lastCueId: 'color' as never, lastPhrase: TURN_REACT_COLORS[0].name };
    const cfg = { avoidImmediateRepeat: false } as unknown as DrillConfig;
    const r = b.resolveCue(pickedOf('color', 'Red'), rng, cfg, prior);
    expect(r.phrase).toBe(TURN_REACT_COLORS[0].name);
  });

  it('plays a beep (never speaks) and floors at the reveal window + pad', () => {
    const engine = fakeEngine(800);
    b.presentCue('Blue', engine);
    expect(mockPlayBeep).toHaveBeenCalledTimes(1);
    expect(engine.spoken).toEqual([]);
    expect(b.minIntervalFloorMs('Blue', engine)).toBe(REVEAL_WINDOW_MS + 250);
  });

  it('primes the beep and resolves the real verifier', async () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).toHaveBeenCalledTimes(1);
    const v = await b.resolveVerifier();
    expect(mockGetPoseVerifierAsync).toHaveBeenCalledTimes(1);
    expect(v.available).toBe(true);
  });
});
