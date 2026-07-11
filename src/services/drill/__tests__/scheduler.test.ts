import { createDefaultDrillConfig } from '@/constants';
import { createRng } from '@/utils/rng';

import {
  buildCandidates,
  initialSchedulerState,
  nextIntervalMs,
  pickCue,
} from '../CueScheduler';

describe('CueScheduler', () => {
  it('nextIntervalMs stays within configured bounds', () => {
    const config = createDefaultDrillConfig({
      intervalMinSec: 2.5,
      intervalMaxSec: 5,
    });
    const random = createRng(42);
    for (let i = 0; i < 50; i++) {
      const v = nextIntervalMs(random, config);
      expect(v).toBeGreaterThanOrEqual(2500);
      expect(v).toBeLessThanOrEqual(5000);
    }
  });

  it('nextIntervalMs respects floor', () => {
    const config = createDefaultDrillConfig({
      intervalMinSec: 1,
      intervalMaxSec: 1,
    });
    expect(nextIntervalMs(() => 0, config, 2500)).toBe(2500);
  });

  it('pickCue avoids immediate repeat when alternatives exist', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['scan', 'turn'],
      avoidImmediateRepeat: true,
    });
    const first = pickCue(() => 0, config, initialSchedulerState());
    const second = pickCue(() => 0, config, first.nextState);
    expect(second.cue.cueId).not.toBe(first.cue.cueId);
  });

  it('buildCandidates zeroes the last cue when avoidImmediateRepeat is on', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['scan', 'turn'],
      avoidImmediateRepeat: true,
    });
    const c = buildCandidates(config, {
      lastCueId: 'scan',
      lastPhrase: 'Scan',
    });
    expect(c.find((x) => x.value === 'scan')?.weight).toBe(0);
    expect(c.find((x) => x.value === 'turn')?.weight).toBeGreaterThan(0);
  });
});
