import {
  CUE_CATALOG,
  DEFAULT_ENABLED_CUES,
  getCueDefinition,
  isDirectionalCheck,
} from '../cues';
import {
  clampLeftRightBalance,
  createDefaultDrillConfig,
  signedBlindSideBalance,
} from '../defaults';
import {
  directionalLeftProbability,
  pickDirectionalCheck,
  pickNextCue,
} from '../pickCue';

describe('cue catalog', () => {
  it('covers the core CueType set exactly once each', () => {
    const ids = CUE_CATALOG.map((c) => c.id);
    expect(ids).toEqual([
      'check_left',
      'check_right',
      'scan',
      'turn',
      'man_on',
      'open_body',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes label, description, spoken, and HUD fields for every cue', () => {
    for (const cue of CUE_CATALOG) {
      expect(cue.label.length).toBeGreaterThan(0);
      expect(cue.description.length).toBeGreaterThan(0);
      expect(cue.spokenLabel.length).toBeGreaterThan(0);
      expect(cue.hudLabel.length).toBeGreaterThan(0);
      expect(cue.type).toBe(cue.id);
      expect(getCueDefinition(cue.id)).toEqual(cue);
    }
  });

  it('marks only check_left / check_right as directional', () => {
    expect(isDirectionalCheck('check_left')).toBe(true);
    expect(isDirectionalCheck('check_right')).toBe(true);
    expect(isDirectionalCheck('scan')).toBe(false);
    expect(isDirectionalCheck('man_on')).toBe(false);
  });
});

describe('defaults + balance helpers', () => {
  it('createDefaultDrillConfig uses audio mode and full default cue set', () => {
    const config = createDefaultDrillConfig();
    expect(config.mode).toBe('audio');
    expect(config.enabledCues).toEqual([...DEFAULT_ENABLED_CUES]);
    expect(config.leftRightBalance).toBe(0.5);
    expect(config.haptics).toBe(true);
    expect(config.spokenCountdown).toBe(true);
  });

  it('clamps left/right balance into [0, 1]', () => {
    expect(clampLeftRightBalance(-1)).toBe(0);
    expect(clampLeftRightBalance(2)).toBe(1);
    expect(clampLeftRightBalance(0.25)).toBe(0.25);
  });

  it('signedBlindSideBalance matches METRICS definition', () => {
    expect(signedBlindSideBalance(0, 0)).toBeNull();
    expect(signedBlindSideBalance(3, 1)).toBe(0.5);
    expect(signedBlindSideBalance(1, 1)).toBe(0);
    expect(signedBlindSideBalance(0, 4)).toBe(-1);
  });
});

describe('pickNextCue', () => {
  it('throws on empty enabled list', () => {
    expect(() =>
      pickNextCue({
        enabled: [],
        recent: [],
        leftRightBalance: 0.5,
        leftCount: 0,
        rightCount: 0,
      }),
    ).toThrow(/empty/);
  });

  it('avoids repeating the last cue when alternatives exist', () => {
    const picks = Array.from({ length: 20 }, (_, i) =>
      pickNextCue({
        enabled: ['scan', 'turn'],
        recent: ['scan'],
        leftRightBalance: 0.5,
        leftCount: 0,
        rightCount: 0,
        // Force first branch off scan via deterministic sequence
        random: () => (i % 2 === 0 ? 0.1 : 0.9),
      }),
    );
    expect(picks.every((p) => p === 'turn')).toBe(true);
  });

  it('can repeat when it is the only enabled cue', () => {
    expect(
      pickNextCue({
        enabled: ['scan'],
        recent: ['scan', 'scan'],
        leftRightBalance: 0.5,
        leftCount: 0,
        rightCount: 0,
        random: () => 0.5,
      }),
    ).toBe('scan');
  });

  it('biases directional checks toward the lagging side', () => {
    // Heavy right history + target 0.5 ⇒ prefer left
    const pLeft = directionalLeftProbability({
      leftCount: 1,
      rightCount: 9,
      leftRightBalance: 0.5,
    });
    expect(pLeft).toBeGreaterThan(0.5);

    let left = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      const cue = pickDirectionalCheck({
        options: ['check_left', 'check_right'],
        leftCount: 1,
        rightCount: 9,
        leftRightBalance: 0.5,
        random: () => (i + 0.5) / n, // sweep [0,1)
      });
      if (cue === 'check_left') left += 1;
    }
    expect(left / n).toBeGreaterThan(0.55);
  });

  it('respects a left-only enabled set', () => {
    expect(
      pickNextCue({
        enabled: ['check_left', 'scan'],
        recent: ['scan'],
        leftRightBalance: 0.5,
        leftCount: 0,
        rightCount: 10,
        random: () => 0.01,
      }),
    ).toBe('check_left');
  });
});
