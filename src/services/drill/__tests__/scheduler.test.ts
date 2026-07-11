import { createDefaultDrillConfig } from '@/constants';
import { PausableDrillClocks } from '@/utils/clocks';
import { createRng } from '@/utils/rng';

import { pickIntervalMs } from '../pickInterval';
import {
  createInitialSchedulerSnapshot,
  fireCueAt,
  remainingDrillMs,
  shouldFireCue,
} from '../scheduler';

describe('pickIntervalMs', () => {
  it('stays within inclusive bounds', () => {
    const random = createRng(42);
    for (let i = 0; i < 50; i++) {
      const v = pickIntervalMs(2500, 5000, random);
      expect(v).toBeGreaterThanOrEqual(2500);
      expect(v).toBeLessThanOrEqual(5000);
    }
  });

  it('returns min when min === max', () => {
    expect(pickIntervalMs(3000, 3000, () => 0.99)).toBe(3000);
  });
});

describe('PausableDrillClocks', () => {
  it('freezes drill time while paused and continues on resume', () => {
    let wall = 1_000;
    const clocks = new PausableDrillClocks(() => wall);

    clocks.start(wall);
    wall = 1_400;
    expect(clocks.drillNow()).toBe(400);

    clocks.pause(wall);
    wall = 2_000;
    expect(clocks.drillNow()).toBe(400);

    clocks.resume(wall);
    wall = 2_250;
    expect(clocks.drillNow()).toBe(650);
  });

  it('remainingDrillMs hits zero at duration', () => {
    expect(remainingDrillMs(180_000, 50_000)).toBe(130_000);
    expect(remainingDrillMs(180_000, 180_000)).toBe(0);
    expect(remainingDrillMs(180_000, 200_000)).toBe(0);
  });
});

describe('scheduler fire + repeat avoidance', () => {
  it('schedules the next cue after an interval and records dual clocks', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['scan', 'turn'],
      intervalMs: { min: 1000, max: 1000 },
      seed: 7,
    });
    const random = createRng(7);
    let snap = createInitialSchedulerSnapshot(config, random);
    expect(snap.nextCueAtDrillMs).toBe(1000);

    expect(shouldFireCue(snap, 999, config.durationMs)).toBe(false);
    expect(shouldFireCue(snap, 1000, config.durationMs)).toBe(true);

    const fired = fireCueAt({
      config,
      snapshot: snap,
      onsetDrillMs: 1000,
      onsetWallMs: 50_000,
      random,
      id: 'cue_1',
    });

    expect(fired.event.onsetDrillMs).toBe(1000);
    expect(fired.event.onsetWallMs).toBe(50_000);
    expect(fired.event.plannedOffsetMs).toBe(1000);
    expect(fired.event.phrase.length).toBeGreaterThan(0);
    expect(fired.event.verification).toBeNull();
    expect(fired.snapshot.cuesFired).toBe(1);
    expect(fired.snapshot.nextCueAtDrillMs).toBe(2000);
    expect(['scan', 'turn']).toContain(fired.cue.type);

    snap = fired.snapshot;
    const second = fireCueAt({
      config,
      snapshot: snap,
      onsetDrillMs: 2000,
      onsetWallMs: 51_000,
      random: () => 0.1,
      id: 'cue_2',
    });
    // With recent=['scan'|'turn'] and both enabled, avoidLastN=1 forces the other.
    expect(second.cue.type).not.toBe(fired.cue.type);
  });

  it('does not fire after duration', () => {
    const config = createDefaultDrillConfig({
      durationMs: 5_000,
      intervalMs: { min: 1000, max: 1000 },
    });
    const snap = createInitialSchedulerSnapshot(config, () => 0);
    expect(shouldFireCue(snap, 5_000, config.durationMs)).toBe(false);
  });

  it('resolves a color phrase when variable cues are enabled', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['color'],
      intervalMs: { min: 1000, max: 1000 },
    });
    const fired = fireCueAt({
      config,
      snapshot: createInitialSchedulerSnapshot(config, () => 0),
      onsetDrillMs: 1000,
      onsetWallMs: 1,
      random: createRng(9),
      id: 'cue_color',
    });
    expect(fired.cue.id).toBe('color');
    expect(fired.phrase).toBe(fired.event.phrase);
    expect(fired.phrase).not.toBe('Color');
  });
});
