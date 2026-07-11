/**
 * Unit tests for the validation harness scorers (docs/field-validation-protocol.md).
 * Two layers:
 *  1. The scoring math (matchScans / scoreScanCounts / scoreDirection / scoreReaction) on
 *     hand-built ScanEvent[] + labels with literal known answers — pins P/R/F1, the Wilson CI,
 *     one-to-one matching, distractor false-positives, and reaction MAE/bias + the L_pipe offset.
 *  2. buildReport end-to-end through the FROZEN detector (detectScans/computeScanVerification),
 *     confirming peak↔onset share a detection stream (identical counts) while the reaction anchor
 *     and metricsVersion move — i.e. the harness reflects the app, it does not re-implement it.
 */

import type { CueEvent } from '@/types';
import type { DerivedCaptureBundle } from '../../frameCapture';
import { detectScans } from '../../scanDetect';
import {
  DEFAULT_CALIBRATION,
  DEFAULT_ENRICHMENT,
  DEFAULT_SCAN_DETECT_CONFIG,
  type PoseSample,
  type ScanDirection,
  type ScanEvent,
} from '../../types';
import type { LabeledTurn, ValidationLabels } from '../validationLabels';
import {
  ACCEPTANCE_TARGETS,
  buildReport,
  matchScans,
  scoreDirection,
  scoreReaction,
  scoreScanCounts,
} from '../validationReport';

const CFG = DEFAULT_SCAN_DETECT_CONFIG;

const evt = (tMonoMs: number, direction: ScanDirection, onsetMonoMs = tMonoMs): ScanEvent => ({
  tMonoMs,
  direction,
  peakYawDeg: direction === 'left' ? -45 : 45,
  onsetMonoMs,
});
const turn = (tMonoMs: number, direction: ScanDirection, extra: Partial<LabeledTurn> = {}): LabeledTurn => ({
  tMonoMs,
  direction,
  ...extra,
});
const cue = (index: number, onsetDrillMs: number): CueEvent => ({
  id: `cue-${index}`,
  cueId: 'turn',
  index,
  phrase: 'Turn',
  onsetWallMs: 0,
  onsetDrillMs,
  plannedOffsetMs: onsetDrillMs,
});

describe('scoreScanCounts', () => {
  it('scores a clean 1:1 match as P=R=F1=1', () => {
    const scans = [evt(500, 'left'), evt(1500, 'right')];
    const labels = [turn(480, 'left'), turn(1520, 'right')];
    const s = scoreScanCounts(scans, labels, 350);
    expect(s.truePositives).toBe(2);
    expect(s.falsePositives).toBe(0);
    expect(s.falseNegatives).toBe(0);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(1);
    expect(s.f1).toBe(1);
  });

  it('counts a missed label as a false negative and a spurious scan as a false positive', () => {
    // label@2500 has no scan (FN); scan@5000 has no label (FP).
    const scans = [evt(500, 'left'), evt(5000, 'right')];
    const labels = [turn(480, 'left'), turn(2500, 'right')];
    const s = scoreScanCounts(scans, labels, 350);
    expect(s.truePositives).toBe(1);
    expect(s.falseNegatives).toBe(1);
    expect(s.falsePositives).toBe(1);
    expect(s.precision).toBe(0.5);
    expect(s.recall).toBe(0.5);
    expect(s.f1).toBeCloseTo(0.5, 10);
  });

  it('flags a scan landing on a distractor as a false positive (never a match)', () => {
    const scans = [evt(500, 'left'), evt(900, 'left')]; // second is a ball-watch false positive
    const labels = [turn(480, 'left'), turn(900, 'left', { distractor: true })];
    const s = scoreScanCounts(scans, labels, 350);
    expect(s.truePositives).toBe(1); // only the genuine turn
    expect(s.falsePositives).toBe(1); // the scan on the distractor
    expect(s.distractorFalsePositives).toBe(1);
    expect(s.falseNegatives).toBe(0); // distractors are not recall targets
  });

  it('matches one-to-one: two scans on one turn is 1 TP + 1 FP, not 2 TP', () => {
    const scans = [evt(480, 'left'), evt(560, 'left')];
    const labels = [turn(500, 'left')];
    const s = scoreScanCounts(scans, labels, 350);
    expect(s.truePositives).toBe(1); // nearest scan (480, Δ20) wins the label
    expect(s.falsePositives).toBe(1); // the other scan is unmatched
    expect(s.matches[0].scanIdx).toBe(0);
  });

  it('respects the time tolerance boundary', () => {
    const scans = [evt(851, 'left')];
    const labels = [turn(500, 'left')];
    expect(scoreScanCounts(scans, labels, 350).truePositives).toBe(0); // Δ351 > 350
    expect(scoreScanCounts(scans, labels, 351).truePositives).toBe(1); // Δ351 == 351
  });

  it('compares against the onset field when the label anchor is onset', () => {
    const scans = [evt(900, 'right', 600)]; // peak 900, onset 600
    const peakLabel = [turn(900, 'right', { timeAnchor: 'peak' })];
    const onsetLabel = [turn(600, 'right', { timeAnchor: 'onset' })];
    expect(scoreScanCounts(scans, peakLabel, 50).truePositives).toBe(1);
    expect(scoreScanCounts(scans, onsetLabel, 50).truePositives).toBe(1);
    // The onset label must NOT match the peak time.
    expect(scoreScanCounts(scans, [turn(900, 'right', { timeAnchor: 'onset' })], 50).truePositives).toBe(0);
  });
});

describe('scoreDirection', () => {
  it('scores direction over the matched pairs with a Wilson 95% CI', () => {
    const scans = [evt(500, 'left'), evt(1500, 'right'), evt(2500, 'left')];
    const labels = [turn(500, 'left'), turn(1500, 'left'), turn(2500, 'left')]; // middle is wrong
    const count = scoreScanCounts(scans, labels, 350);
    const d = scoreDirection(scans, labels, count.matches);
    expect(d.matched).toBe(3);
    expect(d.correct).toBe(2);
    expect(d.accuracy).toBeCloseTo(2 / 3, 10);
    // Wilson interval brackets the point estimate and stays within [0,1].
    expect(d.wilsonLow!).toBeGreaterThan(0);
    expect(d.wilsonLow!).toBeLessThan(2 / 3);
    expect(d.wilsonHigh!).toBeGreaterThan(2 / 3);
    expect(d.wilsonHigh!).toBeLessThanOrEqual(1);
  });

  it('is null with no matched pairs', () => {
    const d = scoreDirection([], [], []);
    expect(d.accuracy).toBeNull();
    expect(d.wilsonLow).toBeNull();
  });

  it('gives a perfect-accuracy Wilson upper bound of 1 and a lower bound < 1', () => {
    const scans = [evt(500, 'left'), evt(1500, 'right')];
    const labels = [turn(500, 'left'), turn(1500, 'right')];
    const count = scoreScanCounts(scans, labels, 350);
    const d = scoreDirection(scans, labels, count.matches);
    expect(d.accuracy).toBe(1);
    expect(d.wilsonHigh).toBe(1);
    expect(d.wilsonLow!).toBeLessThan(1);
  });
});

describe('scoreReaction', () => {
  const cues = [cue(0, 1000), cue(1, 2000)];
  // Onset anchors 1200 / 2300 ⇒ raw onset reactions 200 / 300.
  const scans = [evt(1400, 'left', 1200), evt(2500, 'right', 2300)];

  it('measures onset MAE/bias against the ground truth after the L_pipe offset', () => {
    // Ground truth 180 / 280; predicted (raw) 200 / 300; L_pipe 20 ⇒ predicted 180 / 280 ⇒ error 0.
    const reactions = [
      { cueIndex: 0, reactionMs: 180 },
      { cueIndex: 1, reactionMs: 280 },
    ];
    const r = scoreReaction(scans, cues, reactions, { anchor: 'onset', pipelineLatencyMs: 20 });
    expect(r.matched).toBe(2);
    expect(r.unmatched).toBe(0);
    expect(r.maeMs).toBe(0);
    expect(r.biasMs).toBe(0);
  });

  it('shows a positive bias when the app is stamped late (no L_pipe correction)', () => {
    const reactions = [
      { cueIndex: 0, reactionMs: 180 },
      { cueIndex: 1, reactionMs: 280 },
    ];
    const r = scoreReaction(scans, cues, reactions, { anchor: 'onset' }); // L_pipe = 0
    // Predicted 200/300 vs truth 180/280 ⇒ errors +20/+20 ⇒ bias +20, MAE 20.
    expect(r.biasMs).toBe(20);
    expect(r.maeMs).toBe(20);
  });

  it('peak anchor is inflated vs the onset ground truth (why onset exists, §4)', () => {
    const reactions = [
      { cueIndex: 0, reactionMs: 180 },
      { cueIndex: 1, reactionMs: 280 },
    ];
    // Peak anchors 1400/2500 ⇒ raw 400/500; vs onset truth 180/280 ⇒ bias +220.
    const peak = scoreReaction(scans, cues, reactions, { anchor: 'peak' });
    const onset = scoreReaction(scans, cues, reactions, { anchor: 'onset' });
    expect(peak.biasMs!).toBeGreaterThan(onset.biasMs!);
    expect(peak.maeMs!).toBeGreaterThan(onset.maeMs!);
  });

  it('reports a labeled reaction whose cue drew no in-window scan as unmatched', () => {
    const lonely = [cue(9, 100_000)];
    const r = scoreReaction(scans, lonely, [{ cueIndex: 9, reactionMs: 200 }], { anchor: 'onset' });
    expect(r.matched).toBe(0);
    expect(r.unmatched).toBe(1);
    expect(r.maeMs).toBeNull();
  });
});

// --- End-to-end through the frozen detector ------------------------------------------------

/** The golden yaw script (left turn, ball-watch bob, right turn) as a raw PoseSample stream. */
const YAW_SCRIPT = [
  0, 0, 0, 0, 0, -15, -30, -45, -45, -25, -10, 0, -10, 8, -6, 0, 0, 18, 33, 45, 40, 20, 12, 0, 0, 0,
];
const SAMPLES: PoseSample[] = YAW_SCRIPT.map((yawDeg, idx) => ({
  tMonoMs: idx * 66,
  yawDeg,
  confidence: 0.9,
}));

function makeBundle(cues: CueEvent[]): DerivedCaptureBundle {
  return {
    synthetic: true,
    capturedAtEpochMs: 0,
    engineLabel: 'test-engine',
    calibration: DEFAULT_CALIBRATION,
    scanDetectConfig: CFG,
    enrichment: DEFAULT_ENRICHMENT,
    samples: SAMPLES,
    scans: detectScans(SAMPLES, CFG),
    cues,
    actualDurationSec: 2,
  };
}

describe('buildReport (end-to-end, frozen detector)', () => {
  const scans = detectScans(SAMPLES, CFG); // left@peak 462 onset 330; right@peak 1254 onset 1122
  const cues = [cue(0, 150), cue(1, 950)];
  const L_PIPE = 30;
  const labels: ValidationLabels = {
    sessionId: 'unit',
    groundTruthTurns: [
      turn(scans[0].tMonoMs, 'left'),
      turn(scans[1].tMonoMs, 'right'),
      turn(858, 'left', { distractor: true }), // the ball-watch bob (idx 13)
    ],
    reactions: [
      { cueIndex: 0, reactionMs: scans[0].onsetMonoMs! - cues[0].onsetDrillMs - L_PIPE },
      { cueIndex: 1, reactionMs: scans[1].onsetMonoMs! - cues[1].onsetDrillMs - L_PIPE },
    ],
    pipelineLatencyMs: L_PIPE,
  };

  it('detects exactly the two genuine turns and ignores the distractor', () => {
    expect(scans).toHaveLength(2);
    const report = buildReport(makeBundle(cues), labels, { toleranceMs: 350 });
    const peak = report.configs.find((c) => c.id === 'peak')!;
    expect(peak.count.precision).toBe(1);
    expect(peak.count.recall).toBe(1);
    expect(peak.count.distractorFalsePositives).toBe(0);
    expect(peak.direction.accuracy).toBe(1);
  });

  it('shares a detection stream across peak↔onset but moves reaction + metricsVersion', () => {
    const report = buildReport(makeBundle(cues), labels, { toleranceMs: 350 });
    const peak = report.configs.find((c) => c.id === 'peak')!;
    const onset = report.configs.find((c) => c.id === 'onset')!;

    // Same scans ⇒ identical counts + direction.
    expect(onset.scansDetected).toBe(peak.scansDetected);
    expect(onset.count.f1).toBe(peak.count.f1);
    expect(onset.direction.accuracy).toBe(peak.direction.accuracy);

    // Different reaction anchor + metricsVersion.
    expect(peak.reaction.anchor).toBe('peak');
    expect(onset.reaction.anchor).toBe('onset');
    expect(peak.verification.metricsVersion).toBe(1);
    expect(onset.verification.metricsVersion).toBe(2);

    // Onset matches the (onset-derived, L_pipe-corrected) ground truth exactly; peak is inflated.
    expect(onset.reaction.maeMs).toBe(0);
    expect(onset.reaction.biasMs).toBe(0);
    expect(peak.reaction.biasMs!).toBeGreaterThan(0);
  });

  it('emits all three configs with §7 target verdicts', () => {
    const report = buildReport(makeBundle(cues), labels, { toleranceMs: 350 });
    expect(report.configs.map((c) => c.id)).toEqual(['peak', 'onset', 'onset+smooth']);
    const onset = report.configs.find((c) => c.id === 'onset')!;
    expect(onset.targetsPass.countF1).toBe(true); // F1 1 ≥ 0.90
    expect(onset.targetsPass.direction).toBe(true); // acc 1 ≥ 0.95
    expect(onset.targetsPass.reactionMae).toBe(true); // MAE 0 ≤ 66
    expect(ACCEPTANCE_TARGETS.directionAccuracy).toBe(0.95); // targets are the single source
  });
});
