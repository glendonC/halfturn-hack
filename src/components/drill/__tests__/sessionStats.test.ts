import { summarizeCueDistribution } from '../sessionStats';
import type { CueEvent } from '@/types';

describe('summarizeCueDistribution', () => {
  it('counts cues and sorts by frequency', () => {
    const events = [
      event('scan'),
      event('turn'),
      event('scan'),
      event('check_left'),
      event('scan'),
    ];
    expect(summarizeCueDistribution(events)).toEqual([
      { cueId: 'scan', label: 'SCAN', count: 3 },
      { cueId: 'check_left', label: 'LEFT', count: 1 },
      { cueId: 'turn', label: 'TURN', count: 1 },
    ]);
  });
});

function event(cueId: CueEvent['cueId']): CueEvent {
  return {
    id: cueId,
    cueId,
    index: 0,
    phrase: cueId,
    onsetWallMs: 0,
    onsetDrillMs: 0,
    verification: null,
  };
}
