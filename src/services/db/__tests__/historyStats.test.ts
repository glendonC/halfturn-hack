import { rollupSessions, type HistoryRollup } from '../historyStats';
import type { StoredSessionSummary } from '../types';

function summary(
  partial: Partial<StoredSessionSummary> &
    Pick<StoredSessionSummary, 'id' | 'mode' | 'durationDrillMs' | 'cueCount'>,
): StoredSessionSummary {
  return {
    startedAtWallMs: 1,
    endedAtWallMs: 2,
    distribution: [],
    config: {
      durationMs: 60_000,
      intervalMs: { min: 2000, max: 4000 },
      enabledCues: ['scan'],
      leftRightBalance: 0.5,
      countdownSec: 3,
      spokenCountdown: true,
      haptics: true,
      avoidLastN: 1,
      mode: partial.mode,
    },
    ...partial,
  };
}

describe('rollupSessions', () => {
  it('returns zeros and null verification for an empty history', () => {
    const r = rollupSessions([]);
    expect(r.sessionCount).toBe(0);
    expect(r.totalCues).toBe(0);
    expect(r.scannedBeforeActionRate).toBeNull();
    expect(r.meanReactionMs).toBeNull();
    expect(r.anticipationRate).toBeNull();
  });

  it('sums duration, cues, and mode mix without inventing verification', () => {
    const sessions: StoredSessionSummary[] = [
      summary({
        id: 'a',
        mode: 'audio',
        durationDrillMs: 60_000,
        cueCount: 10,
        distribution: [
          { cueId: 'scan', label: 'SCAN', count: 6 },
          { cueId: 'check_left', label: 'LEFT', count: 4 },
        ],
      }),
      summary({
        id: 'b',
        mode: 'turn_react',
        durationDrillMs: 30_000,
        cueCount: 5,
        distribution: [
          { cueId: 'check_right', label: 'RIGHT', count: 3 },
          { cueId: 'scan', label: 'SCAN', count: 2 },
        ],
      }),
    ];

    const r: HistoryRollup = rollupSessions(sessions);
    expect(r.sessionCount).toBe(2);
    expect(r.totalDurationMs).toBe(90_000);
    expect(r.totalCues).toBe(15);
    expect(r.audioSessions).toBe(1);
    expect(r.turnReactSessions).toBe(1);
    expect(r.leftChecks).toBe(4);
    expect(r.rightChecks).toBe(3);
    expect(r.cueMix.find((c) => c.cueId === 'scan')?.count).toBe(8);
    // Null-honest: never zero-fill verification evidence.
    expect(r.scannedBeforeActionRate).toBeNull();
    expect(r.meanReactionMs).toBeNull();
    expect(r.anticipationRate).toBeNull();
  });
});
