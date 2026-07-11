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
import { getCueDefinition } from '@/constants';
import type { DrillConfig } from '@/types';

import { getDrillModeBehavior, MODE_LAYOUT } from '../index';
import type { PickedCue } from '../types';

const CONFIG = { avoidLastN: 1 } as unknown as DrillConfig;

function fakeEngine(estimate = 800): AudioCueEngine & {
  spoken: { cueId: string; phrase: string }[];
} {
  const spoken: { cueId: string; phrase: string }[] = [];
  return {
    spoken,
    async prepare() {},
    async testSound() {},
    async speakCue(cue, vars) {
      const phrase =
        vars?.color != null
          ? String(vars.color)
          : vars?.number != null
            ? String(vars.number)
            : cue.spokenLabel;
      spoken.push({ cueId: cue.id, phrase });
    },
    async speakText() {},
    async stop() {},
    setOptions() {},
    estimateMs: () => estimate,
  };
}

function pickedOf(cueId: 'scan' | 'color' | 'turn', phrase: string): PickedCue {
  return { cue: getCueDefinition(cueId), phrase };
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
    const r = b.resolveCue(picked, () => 0, CONFIG, null);
    expect(r.phrase).toBe('Scan');
  });

  it('speaks the cue (no beep) and floors at utterance length + pad', () => {
    const engine = fakeEngine(800);
    const cue = getCueDefinition('scan');
    b.presentCue(cue, 'Scan', engine);
    expect(engine.spoken).toEqual([{ cueId: 'scan', phrase: 'Scan' }]);
    expect(mockPlayBeep).not.toHaveBeenCalled();
    expect(b.minIntervalFloorMs('Scan', engine)).toBe(1050);
  });

  it('prepareAudio is a no-op and resolves NullPoseVerifier', () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).not.toHaveBeenCalled();
    const v = b.resolveVerifier();
    expect(v.verifyCue({
      cue: getCueDefinition('scan'),
      cueOnsetDrillMs: 0,
      samples: [],
      windowMs: { early: 0, late: 500 },
    }).outcome).toBe('unknown');
  });
});

describe('TurnReactDrillBehavior', () => {
  const b = getDrillModeBehavior('turn_react');
  const names = TURN_REACT_COLORS.map((c) => c.name);

  it('passes non-color cues through unchanged', () => {
    const picked = pickedOf('scan', 'Scan');
    const r = b.resolveCue(picked, () => 0, CONFIG, null);
    expect(r.phrase).toBe('Scan');
  });

  it('re-rolls the color cue from the readable turn-react palette', () => {
    // rng 0 → index 0 (Red); spoken palette phrase "White" is discarded.
    const picked = pickedOf('color', 'White');
    const r = b.resolveCue(picked, () => 0, CONFIG, null);
    expect(names).toContain(r.phrase);
    expect(r.phrase).not.toBe('White');
  });

  it('honors avoidLastN against the prior phrase', () => {
    // First roll → index 0 = Red (repeats prior); re-roll → index near end.
    const values = [0, 0.99];
    let i = 0;
    const rng = () => values[i++ % values.length]!;
    const r = b.resolveCue(
      pickedOf('color', 'Red'),
      rng,
      CONFIG,
      TURN_REACT_COLORS[0]!.name,
    );
    expect(r.phrase).not.toBe(TURN_REACT_COLORS[0]!.name);
    expect(names).toContain(r.phrase);
  });

  it('allows a repeat when avoidLastN is 0', () => {
    const cfg = { avoidLastN: 0 } as unknown as DrillConfig;
    const r = b.resolveCue(
      pickedOf('color', 'Red'),
      () => 0,
      cfg,
      TURN_REACT_COLORS[0]!.name,
    );
    expect(r.phrase).toBe(TURN_REACT_COLORS[0]!.name);
  });

  it('plays a beep (never speaks) and floors at reveal window + pad', () => {
    const engine = fakeEngine(800);
    b.presentCue(getCueDefinition('color'), 'Blue', engine);
    expect(mockPlayBeep).toHaveBeenCalledTimes(1);
    expect(engine.spoken).toEqual([]);
    expect(b.minIntervalFloorMs('Blue', engine)).toBe(
      REVEAL_WINDOW_MS + REVEAL_PAD_MS,
    );
  });

  it('primes the beep and resolves NullPoseVerifier', () => {
    const engine = fakeEngine();
    b.prepareAudio(engine);
    expect(mockPrimeBeep).toHaveBeenCalledTimes(1);
    const v = b.resolveVerifier();
    expect(v.verifyCue({
      cue: getCueDefinition('scan'),
      cueOnsetDrillMs: 0,
      samples: [],
      windowMs: { early: 0, late: 500 },
    }).outcome).toBe('unknown');
  });
});
