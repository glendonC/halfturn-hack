/**
 * Body-signal enrichment unit tests (docs/scan-tracking-architecture.md §4/§9), on crafted
 * PoseSample/ScanEvent streams with hand-computed exact answers (yaw authored directly, so
 * no atan2 float — values are exact). Covers: detectScans measured enrichment
 * (onset/excursion/peak-velocity), onset-mode reaction + anticipation + distribution +
 * min-sample gating, tracking quality, and One-Euro sample smoothing.
 */

import type { CueEvent } from '@/types';
import { computeScanVerification, computeTrackingQuality, detectScans } from '../scanDetect';
import { smoothPoseSamples } from '../sampleSmoothing';
import { DEFAULT_ONE_EURO_CONFIG } from '../OneEuroFilter';
import {
  DEFAULT_SCAN_DETECT_CONFIG,
  type PoseSample,
  type ScanDirection,
  type ScanEvent,
} from '../types';

const CFG = DEFAULT_SCAN_DETECT_CONFIG;
const mk = (t: number, yaw: number, confidence = 0.9): PoseSample => ({ tMonoMs: t, yawDeg: yaw, confidence });
const scan = (onset: number, direction: ScanDirection, tMonoMs = onset): ScanEvent => ({
  tMonoMs,
  direction,
  peakYawDeg: direction === 'left' ? -45 : 45,
  onsetMonoMs: onset,
});
const cue = (seq: number, firedAtMonoMs: number, cueId: CueEvent['cueId'] = 'color'): CueEvent => ({
  seq,
  cueId,
  category: cueId === 'turn' ? 'action' : 'variable',
  phrase: 'x',
  side: 'none',
  firedAtMonoMs,
  firedAtEpochMs: 0,
  plannedOffsetMs: firedAtMonoMs,
});

describe('detectScans measured enrichment', () => {
  it('computes onset (interpolated), excursion (∫|Δyaw|), and peak velocity', () => {
    // Accelerating left rise so the onset back-extrapolation lands strictly inside the
    // rise foot..enter window (not clamped): steepest slope is at the enter crossing.
    const samples = [
      mk(0, 0),
      mk(100, 0),
      mk(200, -2),
      mk(300, -6),
      mk(400, -30), // enter (|30| ≥ 28)
      mk(500, -45), // peak
      mk(600, -10), // exit (|10| ≤ 15), held 200ms ≥ 150
    ];
    const scans = detectScans(samples, CFG);
    expect(scans).toHaveLength(1);
    const s = scans[0];
    expect(s.direction).toBe('left');
    expect(s.tMonoMs).toBe(500);
    expect(s.startMonoMs).toBe(400);
    expect(s.endMonoMs).toBe(600);
    // Steepest rising slope -240°/s at (t=400, yaw=-30) → onset = 400 - (30/240)*1000 = 275.
    expect(s.onsetMonoMs).toBe(275);
    // ∫|Δyaw| over 200→600: 4 + 24 + 15 + 35 = 78.
    expect(s.excursionDeg).toBe(78);
    // Peak |Δyaw/Δt| over the window: the -10 from -45 descent = 350°/s.
    expect(s.peakAngularVelDegPerSec).toBe(350);
  });

  it('falls the onset back to the rise foot when the rise is a linear ramp', () => {
    const samples = [mk(0, 0), mk(100, -20), mk(200, -40), mk(300, -50), mk(400, -10)];
    const [s] = detectScans(samples, CFG);
    // Linear ramp → back-extrapolation overshoots the foot and clamps to it (t=100).
    expect(s.onsetMonoMs).toBe(100);
    expect(s.onsetMonoMs).toBeLessThanOrEqual(s.startMonoMs!);
  });
});

describe('computeScanVerification — onset mode', () => {
  const scans = [
    scan(1180, 'left'),
    scan(2220, 'right'),
    scan(3260, 'left'),
    scan(4300, 'right'),
    scan(5000, 'left'), // turned before its cue → anticipation
  ];
  const cues = [cue(0, 1000), cue(1, 2000), cue(2, 3000), cue(3, 4000), cue(4, 5100)];

  it('measures reaction from onset, gates anticipation out, and reports the distribution', () => {
    const v = computeScanVerification(scans, cues, 60, 'e', CFG, { reactionMode: 'onset' });
    expect(v.metricsVersion).toBe(2);
    expect(v.scansDetected).toBe(5);
    expect(v.leftScans).toBe(3);
    expect(v.rightScans).toBe(2);
    // Reactions [180, 220, 260, 300]; the -100 pre-cue turn is anticipation (excluded).
    expect(v.avgReactionMs).toBe(240);
    expect(v.medianReactionMs).toBe(240);
    expect(v.reactionP25Ms).toBe(210);
    expect(v.reactionP75Ms).toBe(270);
    expect(v.reactionP90Ms).toBe(288);
    expect(v.bestReactionMs).toBe(180);
    expect(v.anticipationRate).toBe(0.2); // 1 of 5 paired cues
  });

  it('grays out the reaction stats below the minimum sample count', () => {
    const v = computeScanVerification(scans.slice(0, 2), cues.slice(0, 2), 60, 'e', CFG, {
      reactionMode: 'onset',
    });
    expect(v.avgReactionMs).toBeNull();
    expect(v.medianReactionMs).toBeUndefined();
    expect(v.anticipationRate).toBe(0); // both paired, neither anticipated
  });

  it('peak mode is unchanged (metricsVersion 1, no distribution)', () => {
    const v = computeScanVerification(scans, cues, 60, 'e', CFG, { reactionMode: 'peak' });
    expect(v.metricsVersion).toBe(1);
    expect(v.medianReactionMs).toBeUndefined();
    expect(v.anticipationRate).toBeUndefined();
  });

  it('assigns one-to-one: closely-spaced cues never multi-count a single turn', () => {
    // Three cues all inside one turn's window. Independent per-cue matching would count
    // the single turn 3 times (reactions [300,250,200] → clears the min-3 gate with a
    // bogus distribution). One-to-one assigns the turn to its closest cue only.
    const oneTurn = [scan(1300, 'left')];
    const closeCues = [cue(0, 1000), cue(1, 1050), cue(2, 1100)];
    const v = computeScanVerification(oneTurn, closeCues, 60, 'e', CFG, { reactionMode: 'onset' });
    expect(v.avgReactionMs).toBeNull(); // 1 genuine reaction < min-sample gate
    expect(v.medianReactionMs).toBeUndefined();
    expect(v.anticipationRate).toBe(0); // 1 paired, not anticipated (rt 200 ≥ 150)
  });

  it('does not drop a real turn when a nearer turn takes the closest cue', () => {
    // cueA/cueB close together; turnX near both, turnY far. One-to-one gives turnX to its
    // closest cue and still pairs turnY to the remaining free cue (not dropped).
    const twoTurns = [scan(1100, 'left'), scan(3000, 'right')];
    const twoCues = [cue(0, 1000), cue(1, 1050)];
    const v = computeScanVerification(twoTurns, twoCues, 60, 'e', CFG, { reactionMode: 'onset' });
    // turnX@1100→cueB(1050) rt50 = anticipation; turnY@3000→cueA(1000) rt2000 = reaction.
    expect(v.anticipationRate).toBe(0.5); // 1 of 2 paired
  });
});

describe('computeTrackingQuality', () => {
  it('reports tracked fraction, mean confidence, and effective fps', () => {
    const q = computeTrackingQuality([mk(0, 0), mk(100, 0), mk(200, 0, 0.3), mk(300, 0)], CFG);
    expect(q.trackedTimeRate).toBe(0.75); // 3 of 4 above the 0.5 gate
    expect(q.meanPoseConfidence).toBe(0.75);
    expect(q.effectiveFps).toBe(10); // 3 gaps over 300ms
  });

  it('is all-zero for an empty stream', () => {
    expect(computeTrackingQuality([], CFG)).toEqual({
      trackedTimeRate: 0,
      meanPoseConfidence: 0,
      effectiveFps: 0,
    });
  });
});

describe('smoothPoseSamples', () => {
  it('passes the first sample through and attenuates a spike, preserving other fields', () => {
    const samples = [mk(0, 0), mk(66, 0), mk(132, 50), mk(198, 0), mk(264, 0)];
    const out = smoothPoseSamples(samples, DEFAULT_ONE_EURO_CONFIG);
    expect(out).toHaveLength(5);
    expect(out[0].yawDeg).toBe(0); // first sample passes through
    expect(out[2].yawDeg).toBeLessThan(50); // spike attenuated
    expect(out[2].yawDeg).toBeGreaterThan(0);
    // Non-yaw fields echoed unchanged.
    expect(out[2].tMonoMs).toBe(132);
    expect(out[2].confidence).toBe(0.9);
  });
});
