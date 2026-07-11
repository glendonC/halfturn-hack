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
      { cueId: 'scan', label: 'Scan', count: 3 },
      { cueId: 'check_left', label: 'Left', count: 1 },
      { cueId: 'turn', label: 'Turn', count: 1 },
    ]);
  });
});

function event(cueId: CueEvent['cueId']): CueEvent {
  return {
    seq: 0,
    cueId,
    category: cueId.startsWith('check') ? 'direction' : 'action',
    phrase: cueId,
    side: cueId === 'check_left' ? 'left' : cueId === 'check_right' ? 'right' : 'none',
    firedAtEpochMs: 0,
    firedAtMonoMs: 0,
    plannedOffsetMs: 0,
  };
}
