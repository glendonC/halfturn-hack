import { createDefaultDrillConfig } from '@/constants';
import { PausableDrillClocks } from '@/utils/clocks';
import { createRng } from '@/utils/rng';

import {
  buildCandidates,
  initialSchedulerState,
  nextIntervalMs,
  pickCue,
} from '../CueScheduler';
import {
  createInitialSchedulerSnapshot,
  fireCueAt,
  remainingDrillMs,
  shouldFireCue,
} from '../scheduler';

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
      intervalMinSec: 1,
      intervalMaxSec: 1,
    });
    const random = createRng(7);
    let snap = createInitialSchedulerSnapshot(config, random);
    expect(snap.nextCueAtDrillMs).toBe(1000);

    const durationMs = config.durationSec * 1000;
    expect(shouldFireCue(snap, 999, durationMs)).toBe(false);
    expect(shouldFireCue(snap, 1000, durationMs)).toBe(true);

    const fired = fireCueAt({
      config,
      snapshot: snap,
      firedAtMonoMs: 1000,
      firedAtEpochMs: 50_000,
      random,
    });

    expect(fired.event.firedAtMonoMs).toBe(1000);
    expect(fired.event.firedAtEpochMs).toBe(50_000);
    expect(fired.event.plannedOffsetMs).toBe(1000);
    expect(fired.event.phrase.length).toBeGreaterThan(0);
    expect(fired.snapshot.cuesFired).toBe(1);
    expect(fired.snapshot.nextCueAtDrillMs).toBe(2000);
    expect(['scan', 'turn']).toContain(fired.cue.id);

    snap = fired.snapshot;
    const second = fireCueAt({
      config,
      snapshot: snap,
      firedAtMonoMs: 2000,
      firedAtEpochMs: 51_000,
      random: () => 0.1,
    });
    expect(second.cue.id).not.toBe(fired.cue.id);
  });

  it('does not fire after duration', () => {
    const config = createDefaultDrillConfig({
      durationSec: 5,
      intervalMinSec: 1,
      intervalMaxSec: 1,
    });
    const snap = createInitialSchedulerSnapshot(config, () => 0);
    expect(shouldFireCue(snap, 5_000, config.durationSec * 1000)).toBe(false);
  });

  it('resolves a color phrase when variable cues are enabled', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['color'],
      intervalMinSec: 1,
      intervalMaxSec: 1,
    });
    const fired = fireCueAt({
      config,
      snapshot: createInitialSchedulerSnapshot(config, () => 0),
      firedAtMonoMs: 1000,
      firedAtEpochMs: 1,
      random: createRng(9),
    });
    expect(fired.cue.id).toBe('color');
    expect(fired.phrase).toBe(fired.event.phrase);
    expect(fired.phrase).not.toBe('Color');
  });

  it('floors the next gap using intervalFloorMs from the spoken phrase', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['scan'],
      intervalMinSec: 0.5,
      intervalMaxSec: 0.5,
    });
    const fired = fireCueAt({
      config,
      snapshot: createInitialSchedulerSnapshot(config, () => 0),
      firedAtMonoMs: 1000,
      firedAtEpochMs: 1,
      random: () => 0,
      intervalFloorMs: (phrase) => (phrase === 'Scan' ? 2000 : 0),
    });
    expect(fired.snapshot.nextCueAtDrillMs).toBe(3000);
  });

  it('honors avoidImmediateRepeat from DrillConfig', () => {
    const config = createDefaultDrillConfig({
      enabledCues: ['scan', 'turn'],
      intervalMinSec: 1,
      intervalMaxSec: 1,
      avoidImmediateRepeat: true,
    });
    const first = fireCueAt({
      config,
      snapshot: createInitialSchedulerSnapshot(config, () => 0),
      firedAtMonoMs: 1000,
      firedAtEpochMs: 1,
      random: () => 0,
    });
    const second = fireCueAt({
      config,
      snapshot: first.snapshot,
      firedAtMonoMs: 2000,
      firedAtEpochMs: 2,
      random: () => 0,
    });
    expect(second.cue.id).not.toBe(first.cue.id);
  });
});
