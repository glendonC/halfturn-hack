/**
 * Off-device validation harness (docs/field-validation-protocol.md,
 * docs/scan-tracking-architecture.md §7). Replays a DERIVED capture bundle through the
 * SAME frozen pure functions the device runs — `detectScans`, `smoothPoseSamples`,
 * `computeScanVerification`, `computeTrackingQuality` — under the peak / onset / onset+smooth
 * configs, and scores each against a human {@link ValidationLabels} set:
 *   - scan-count precision / recall / F1 at a point-event time tolerance (§7),
 *   - turn-direction accuracy with a Wilson 95% CI (§7),
 *   - reaction MAE / bias vs the 240-fps flash->onset ground truth, after the L_pipe offset (§4).
 *
 * Load-bearing property: it REUSES the frozen detector/metrics, never re-implements them, so a
 * report reflects exactly what the app produces (and cannot silently drift from it). Pure +
 * deterministic (no Date, no random) so it is unit-testable and stable across the golden gate.
 * The only new logic here is the scoring math (matching + P/R/F1 + Wilson + MAE), which is what
 * the unit tests pin.
 */

import type { CueEvent, ScanVerification } from '@/types';
import type { DerivedCaptureBundle } from '../frameCapture';
import { DEFAULT_ONE_EURO_CONFIG, type OneEuroConfig } from '../OneEuroFilter';
import { smoothPoseSamples } from '../sampleSmoothing';
import {
  computeCuedDirectionAccuracy,
  computeScanVerification,
  computeTrackingQuality,
  detectScans,
  type CuedTurnScore,
} from '../scanDetect';
import type { EnrichmentConfig, ReactionMode, ScanEvent, TrackingQuality } from '../types';
import type { LabeledReaction, LabeledTurn, TurnTimeAnchor, ValidationLabels } from './validationLabels';

/** §7 acceptance targets, in one place so the report and the docs cannot drift apart. */
export const ACCEPTANCE_TARGETS = {
  directionAccuracy: 0.95,
  countPrecision: 0.9,
  countRecall: 0.9,
  countF1: 0.9,
  reactionMaeMs: 66,
  reactionBiasMs: 33,
  trackedTimeRate: 0.9,
  effectiveFps: 12,
  /** Mid of the §7 300-400 ms point-event tolerance band. */
  defaultToleranceMs: 350,
} as const;

/** Anticipation lookback for reaction pairing (mirrors scanDetect §4; not exported there). */
const REACTION_LOOKBACK_MS = 800;

/** The predicted-scan instant to compare against a labeled turn/reaction of the given anchor. */
function anchorTime(s: ScanEvent, anchor: TurnTimeAnchor): number {
  if (anchor === 'onset') return s.onsetMonoMs ?? s.startMonoMs ?? s.tMonoMs;
  return s.tMonoMs;
}

// ---------------------------------------------------------------------------
// Scan-count P/R/F1 (§7)
// ---------------------------------------------------------------------------

/** A one-to-one predicted-scan <-> genuine-label pairing. */
export interface ScanMatch {
  scanIdx: number;
  labelIdx: number;
  deltaMs: number;
}

export interface CountScore {
  toleranceMs: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  /** FPs (unmatched predicted scans) landing within tolerance of a labeled distractor. */
  distractorFalsePositives: number;
  /** The TP pairing, reused for direction scoring so both agree on which scans matched. */
  matches: ScanMatch[];
}

/**
 * Greedy nearest-first one-to-one match of predicted scans to genuine labels within tolerance,
 * comparing each predicted scan on the field the label's `timeAnchor` names. Greedy-by-|Δt| is
 * stable (V8 sort is stable) so the pairing is deterministic. Independent per-label nearest
 * matching would let one physical turn satisfy two labels (or vice-versa); one-to-one does not.
 */
export function matchScans(
  predicted: ScanEvent[],
  genuineLabels: LabeledTurn[],
  toleranceMs: number,
): ScanMatch[] {
  const cands: ScanMatch[] = [];
  predicted.forEach((s, scanIdx) => {
    genuineLabels.forEach((l, labelIdx) => {
      const delta = anchorTime(s, l.timeAnchor ?? 'peak') - l.tMonoMs;
      if (Math.abs(delta) <= toleranceMs) cands.push({ scanIdx, labelIdx, deltaMs: delta });
    });
  });
  cands.sort((a, b) => Math.abs(a.deltaMs) - Math.abs(b.deltaMs));
  const usedScan = new Set<number>();
  const usedLabel = new Set<number>();
  const out: ScanMatch[] = [];
  for (const c of cands) {
    if (usedScan.has(c.scanIdx) || usedLabel.has(c.labelIdx)) continue;
    usedScan.add(c.scanIdx);
    usedLabel.add(c.labelIdx);
    out.push(c);
  }
  return out;
}

/**
 * Score predicted scans against hand-coded turns at a time tolerance. Genuine turns are the
 * recall targets; distractors are never matched (a predicted scan on one is a false positive,
 * also surfaced as `distractorFalsePositives`). Direction is NOT required for a count match —
 * it is scored separately by {@link scoreDirection} over the same matches, mirroring §7's split.
 */
export function scoreScanCounts(
  predicted: ScanEvent[],
  labels: LabeledTurn[],
  toleranceMs: number = ACCEPTANCE_TARGETS.defaultToleranceMs,
): CountScore {
  // No labels at all ⇒ nothing to score against. Precision over an EMPTY ground truth is
  // undefined, not zero: every predicted scan would count as a false positive and the report
  // would print "P 0.0%" for a perfectly good unlabeled capture, which reads as a failure.
  // (A distractor-ONLY label set is different — there the scans really are false positives,
  // so it still scores.)
  if (labels.length === 0) {
    return {
      toleranceMs,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      precision: null,
      recall: null,
      f1: null,
      distractorFalsePositives: 0,
      matches: [],
    };
  }

  const genuine = labels.filter((l) => !l.distractor);
  const distractors = labels.filter((l) => l.distractor);
  const matches = matchScans(predicted, genuine, toleranceMs);

  const matchedScan = new Set(matches.map((m) => m.scanIdx));
  const tp = matches.length;
  const fn = genuine.length - tp;
  const unmatchedPred = predicted.filter((_, i) => !matchedScan.has(i));
  const fp = unmatchedPred.length;

  let distractorFalsePositives = 0;
  for (const s of unmatchedPred) {
    const nearDistractor = distractors.some(
      (l) => Math.abs(anchorTime(s, l.timeAnchor ?? 'peak') - l.tMonoMs) <= toleranceMs,
    );
    if (nearDistractor) distractorFalsePositives += 1;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 =
    precision != null && recall != null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;

  return {
    toleranceMs,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    distractorFalsePositives,
    matches,
  };
}

// ---------------------------------------------------------------------------
// Direction accuracy + Wilson CI (§7)
// ---------------------------------------------------------------------------

export interface DirectionScore {
  matched: number;
  correct: number;
  accuracy: number | null;
  wilsonLow: number | null;
  wilsonHigh: number | null;
}

/** Wilson score interval for k successes in n trials (default z = 1.96 ⇒ 95%). */
function wilson(k: number, n: number, z = 1.96): { low: number; high: number } {
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/** Direction accuracy over the TP pairs (a matched scan whose direction equals the label's). */
export function scoreDirection(
  predicted: ScanEvent[],
  genuineLabels: LabeledTurn[],
  matches: ScanMatch[],
): DirectionScore {
  let correct = 0;
  for (const m of matches) {
    if (predicted[m.scanIdx].direction === genuineLabels[m.labelIdx].direction) correct += 1;
  }
  const matched = matches.length;
  if (matched === 0) {
    return { matched: 0, correct: 0, accuracy: null, wilsonLow: null, wilsonHigh: null };
  }
  const ci = wilson(correct, matched);
  return { matched, correct, accuracy: correct / matched, wilsonLow: ci.low, wilsonHigh: ci.high };
}

// ---------------------------------------------------------------------------
// Reaction MAE / bias vs the 240-fps flash->onset ground truth (§4)
// ---------------------------------------------------------------------------

export interface ReactionScore {
  /** 'onset' matches the flash->onset ground truth; 'peak' shows the turn-execution inflation. */
  anchor: TurnTimeAnchor;
  matched: number;
  /** Labeled reactions whose cue had no predicted scan in the pairing window. */
  unmatched: number;
  maeMs: number | null;
  /** mean(predicted - groundTruth); + ⇒ app reports late (L_pipe under-corrected). */
  biasMs: number | null;
  rmseMs: number | null;
  pipelineLatencyMs: number;
}

export interface ScoreReactionOptions {
  anchor: TurnTimeAnchor;
  pipelineLatencyMs?: number;
  /** Forward window (default the cfg's scanBeforeWindowMs). */
  windowMs?: number;
  /** Pre-cue lookback for anticipated turns (default 800 ms, §4). */
  lookbackMs?: number;
}

/**
 * Compare the app's predicted reaction to the 240-fps ground truth, per cue. Predicted reaction
 * = (scan anchor - cue.firedAtMonoMs) - L_pipe; both are cue-relative deltas, so they are
 * directly comparable to the flash->onset video delta. Each labeled reaction is paired
 * one-to-one to its nearest in-window predicted scan (by the chosen anchor).
 */
export function scoreReaction(
  predicted: ScanEvent[],
  cues: CueEvent[],
  reactions: LabeledReaction[],
  opts: ScoreReactionOptions,
): ReactionScore {
  const L = opts.pipelineLatencyMs ?? 0;
  const window = opts.windowMs ?? 2500;
  const lookback = opts.lookbackMs ?? REACTION_LOOKBACK_MS;
  const cueBySeq = new Map(cues.map((c) => [c.seq, c]));

  const cands: { rIdx: number; scanIdx: number; absRel: number; err: number }[] = [];
  reactions.forEach((r, rIdx) => {
    const cue = cueBySeq.get(r.cueSeq);
    if (!cue) return;
    predicted.forEach((s, scanIdx) => {
      const rel = anchorTime(s, opts.anchor) - cue.firedAtMonoMs; // pre-L_pipe reaction
      if (rel >= -lookback && rel <= window) {
        cands.push({ rIdx, scanIdx, absRel: Math.abs(rel), err: rel - L - r.reactionMs });
      }
    });
  });
  cands.sort((a, b) => a.absRel - b.absRel);

  const usedR = new Set<number>();
  const usedScan = new Set<number>();
  const errors: number[] = [];
  for (const c of cands) {
    if (usedR.has(c.rIdx) || usedScan.has(c.scanIdx)) continue;
    usedR.add(c.rIdx);
    usedScan.add(c.scanIdx);
    errors.push(c.err);
  }

  const withCue = reactions.filter((r) => cueBySeq.has(r.cueSeq)).length;
  const matched = errors.length;
  if (matched === 0) {
    return { anchor: opts.anchor, matched: 0, unmatched: withCue, maeMs: null, biasMs: null, rmseMs: null, pipelineLatencyMs: L };
  }
  const mae = errors.reduce((a, e) => a + Math.abs(e), 0) / matched;
  const bias = errors.reduce((a, e) => a + e, 0) / matched;
  const rmse = Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / matched);
  return {
    anchor: opts.anchor,
    matched,
    unmatched: withCue - matched,
    maeMs: Math.round(mae),
    biasMs: Math.round(bias),
    rmseMs: Math.round(rmse),
    pipelineLatencyMs: L,
  };
}

// ---------------------------------------------------------------------------
// Replay + full report
// ---------------------------------------------------------------------------

export type ReplayConfigId = 'peak' | 'onset' | 'onset+smooth';

interface ReplayResult {
  scans: ScanEvent[];
  quality: TrackingQuality;
  verification: ScanVerification;
}

/**
 * Re-derive scans + quality + verification from a bundle's RAW samples under one config, using
 * the frozen device functions. `smoothing` is applied to the DETECTION stream only (matching
 * RealPoseVerifier.stop); quality is always measured on the raw samples.
 */
function replay(
  bundle: DerivedCaptureBundle,
  reactionMode: ReactionMode,
  smoothing: OneEuroConfig | null,
): ReplayResult {
  const cfg = bundle.scanDetectConfig;
  const detectInput = smoothing ? smoothPoseSamples(bundle.samples, smoothing) : bundle.samples;
  const scans = detectScans(detectInput, cfg);
  const quality = computeTrackingQuality(bundle.samples, cfg);
  const verification = computeScanVerification(
    scans,
    bundle.cues,
    bundle.actualDurationSec,
    bundle.engineLabel,
    cfg,
    { reactionMode, quality },
  );
  return { scans, quality, verification };
}

export interface TargetsPass {
  direction: boolean | null;
  countF1: boolean | null;
  reactionMae: boolean | null;
  reactionBias: boolean | null;
  trackedTimeRate: boolean;
  effectiveFps: boolean;
}

export interface ConfigReport {
  id: ReplayConfigId;
  reactionMode: ReactionMode;
  smoothed: boolean;
  scansDetected: number;
  count: CountScore;
  direction: DirectionScore;
  reaction: ReactionScore;
  /**
   * Label-free scoring off the session's OWN directional cues (see
   * `computeCuedDirectionAccuracy`). Always computed — it needs no labels — so a capture
   * alone yields a scorecard. Valid for relative A/B comparisons, NOT for the absolute §7
   * acceptance bar.
   */
  cued: CuedTurnScore;
  quality: TrackingQuality;
  verification: ScanVerification;
  targetsPass: TargetsPass;
}

export interface ValidationReport {
  sessionId: string;
  athlete?: string;
  distanceM?: number;
  lighting?: string;
  coder?: string;
  engineLabel: string;
  toleranceMs: number;
  pipelineLatencyMs: number;
  /** False when scored off the cues alone (no hand-coded labels supplied). */
  hasLabels: boolean;
  labeled: { genuineTurns: number; distractors: number; reactions: number };
  onDeviceEnrichment: EnrichmentConfig;
  configs: ConfigReport[];
}

export interface BuildReportOptions {
  toleranceMs?: number;
}

/** Stand-in when a capture is scored with no hand-coded labels (cue-derived axes only). */
const NO_LABELS: ValidationLabels = { sessionId: '(unlabeled)', groundTruthTurns: [] };

function evalTargets(count: CountScore, direction: DirectionScore, reaction: ReactionScore, quality: TrackingQuality): TargetsPass {
  return {
    direction: direction.accuracy != null ? direction.accuracy >= ACCEPTANCE_TARGETS.directionAccuracy : null,
    countF1: count.f1 != null ? count.f1 >= ACCEPTANCE_TARGETS.countF1 : null,
    reactionMae: reaction.maeMs != null ? reaction.maeMs <= ACCEPTANCE_TARGETS.reactionMaeMs : null,
    reactionBias: reaction.biasMs != null ? Math.abs(reaction.biasMs) <= ACCEPTANCE_TARGETS.reactionBiasMs : null,
    trackedTimeRate: quality.trackedTimeRate >= ACCEPTANCE_TARGETS.trackedTimeRate,
    effectiveFps: quality.effectiveFps >= ACCEPTANCE_TARGETS.effectiveFps,
  };
}

function makeConfig(
  id: ReplayConfigId,
  reactionMode: ReactionMode,
  smoothing: OneEuroConfig | null,
  bundle: DerivedCaptureBundle,
  labels: ValidationLabels,
  toleranceMs: number,
): ConfigReport {
  const { scans, quality, verification } = replay(bundle, reactionMode, smoothing);
  const genuine = labels.groundTruthTurns.filter((l) => !l.distractor);
  const count = scoreScanCounts(scans, labels.groundTruthTurns, toleranceMs);
  const direction = scoreDirection(scans, genuine, count.matches);
  const reaction = scoreReaction(scans, bundle.cues, labels.reactions ?? [], {
    anchor: reactionMode === 'onset' ? 'onset' : 'peak',
    pipelineLatencyMs: labels.pipelineLatencyMs,
    windowMs: bundle.scanDetectConfig.scanBeforeWindowMs,
  });
  return {
    id,
    reactionMode,
    smoothed: smoothing != null,
    scansDetected: scans.length,
    count,
    direction,
    reaction,
    cued: computeCuedDirectionAccuracy(scans, bundle.cues, bundle.scanDetectConfig),
    quality,
    verification,
    targetsPass: evalTargets(count, direction, reaction, quality),
  };
}

/**
 * Score one captured session under all three configs (peak / onset / onset+smooth). The
 * scan-count + direction numbers are identical across peak↔onset (same detection stream) and
 * only move under smoothing; the reaction numbers move peak↔onset (that IS the onset
 * promotion, §4). Pure + deterministic.
 *
 * `labels` is OPTIONAL. Without it, the label-dependent axes (count P/R/F1, hand-coded
 * direction, reaction MAE/bias) score as null and the report falls back to the cue-derived
 * `cued` axes, which need no hand-coding — enough to run a model or threshold A/B straight off
 * a field capture. With labels, both are reported side by side.
 */
export function buildReport(
  bundle: DerivedCaptureBundle,
  labels?: ValidationLabels,
  opts: BuildReportOptions = {},
): ValidationReport {
  const toleranceMs = opts.toleranceMs ?? ACCEPTANCE_TARGETS.defaultToleranceMs;
  const l = labels ?? NO_LABELS;
  const genuine = l.groundTruthTurns.filter((t) => !t.distractor).length;
  const distractors = l.groundTruthTurns.length - genuine;
  return {
    sessionId: l.sessionId,
    athlete: l.athlete,
    distanceM: l.distanceM,
    lighting: l.lighting,
    coder: l.coder,
    engineLabel: bundle.engineLabel,
    toleranceMs,
    pipelineLatencyMs: l.pipelineLatencyMs ?? 0,
    hasLabels: labels != null,
    labeled: { genuineTurns: genuine, distractors, reactions: (l.reactions ?? []).length },
    onDeviceEnrichment: bundle.enrichment,
    configs: [
      makeConfig('peak', 'peak', null, bundle, l, toleranceMs),
      makeConfig('onset', 'onset', null, bundle, l, toleranceMs),
      makeConfig('onset+smooth', 'onset', DEFAULT_ONE_EURO_CONFIG, bundle, l, toleranceMs),
    ],
  };
}

/**
 * The two app-facing `ScanVerification` blobs (peak = metricsVersion 1, onset = 2) a bundle
 * produces through the frozen path — the exact objects the app would persist. This is what the
 * real-fixture golden gate freezes and asserts, and what `--freeze` writes to `<id>.expected.json`.
 * Independent of labels (verification is derived from scans + cues only), so it is a stable snapshot.
 */
export function replayVerifications(bundle: DerivedCaptureBundle): {
  peak: ScanVerification;
  onset: ScanVerification;
} {
  return {
    peak: replay(bundle, 'peak', null).verification,
    onset: replay(bundle, 'onset', null).verification,
  };
}

// ---------------------------------------------------------------------------
// Text formatting (what the CLI / jest runner prints)
// ---------------------------------------------------------------------------

const pct = (x: number | null): string => (x == null ? '  —  ' : `${(x * 100).toFixed(1)}%`);
const ms = (x: number | null): string => (x == null ? '—' : `${x}ms`);
const pass = (x: boolean | null): string => (x == null ? '—' : x ? '✓' : '✗');
const pad = (s: string, w: number): string => (s.length >= w ? s : s + ' '.repeat(w - s.length));

/** Render a report as a fixed-width text block for the console / a saved `.txt`. */
export function formatReport(r: ValidationReport): string {
  const lines: string[] = [];
  lines.push('==================== HalfTurn validation report ====================');
  lines.push(
    `session: ${r.sessionId}   athlete: ${r.athlete ?? '—'}   distance: ${
      r.distanceM != null ? `${r.distanceM}m` : '—'
    }   lighting: ${r.lighting ?? '—'}   coder: ${r.coder ?? '—'}`,
  );
  lines.push(`engine:  ${r.engineLabel}`);
  lines.push(
    r.hasLabels
      ? `labeled: ${r.labeled.genuineTurns} genuine turns, ${r.labeled.distractors} distractors, ${r.labeled.reactions} reactions   tolerance: ±${r.toleranceMs}ms   L_pipe: ${r.pipelineLatencyMs}ms`
      : 'labeled: NONE — scored off the session\'s own directional cues (see the cued-* columns)',
  );
  lines.push(
    `on-device run: reaction=${r.onDeviceEnrichment.reactionMode} smoothing=${
      r.onDeviceEnrichment.smoothing ? 'on' : 'off'
    }`,
  );
  lines.push('');
  lines.push(
    `${pad('config', 14)}${pad('scans', 7)}${pad('P', 7)}${pad('R', 7)}${pad('F1', 7)}${pad('dir%', 8)}${pad('CI95', 15)}${pad('MAE', 8)}${pad('bias', 8)}${pad('track', 7)}${pad('fps', 6)}`,
  );
  for (const c of r.configs) {
    const ci =
      c.direction.wilsonLow != null
        ? `[${(c.direction.wilsonLow * 100).toFixed(0)},${(c.direction.wilsonHigh! * 100).toFixed(0)}]`
        : '—';
    lines.push(
      `${pad(c.id, 14)}${pad(String(c.scansDetected), 7)}${pad(pct(c.count.precision), 7)}${pad(
        pct(c.count.recall),
        7,
      )}${pad(pct(c.count.f1), 7)}${pad(pct(c.direction.accuracy), 8)}${pad(ci, 15)}${pad(
        ms(c.reaction.maeMs),
        8,
      )}${pad(c.reaction.biasMs == null ? '—' : `${c.reaction.biasMs > 0 ? '+' : ''}${c.reaction.biasMs}ms`, 8)}${pad(
        c.quality.trackedTimeRate.toFixed(2),
        7,
      )}${pad(c.quality.effectiveFps.toFixed(1), 6)}`,
    );
  }
  lines.push('');
  lines.push('cue-derived (label-free — the cue\'s own side is the ground truth):');
  lines.push(
    `${pad('config', 14)}${pad('cues', 7)}${pad('seen', 7)}${pad('cued-recall', 13)}${pad('cued-dir%', 11)}`,
  );
  for (const c of r.configs) {
    lines.push(
      `${pad(c.id, 14)}${pad(String(c.cued.cuedTurns), 7)}${pad(String(c.cued.matched), 7)}${pad(
        pct(c.cued.recall),
        13,
      )}${pad(pct(c.cued.accuracy), 11)}`,
    );
  }
  lines.push('');
  lines.push(
    `targets (§7): dir≥${(ACCEPTANCE_TARGETS.directionAccuracy * 100).toFixed(0)}%  F1≥${ACCEPTANCE_TARGETS.countF1}  MAE≤${ACCEPTANCE_TARGETS.reactionMaeMs}  |bias|≤${ACCEPTANCE_TARGETS.reactionBiasMs}  track≥${ACCEPTANCE_TARGETS.trackedTimeRate}  fps≥${ACCEPTANCE_TARGETS.effectiveFps}`,
  );
  for (const c of r.configs) {
    const t = c.targetsPass;
    lines.push(
      `${pad(c.id, 14)}dir ${pass(t.direction)}   F1 ${pass(t.countF1)}   MAE ${pass(t.reactionMae)}   bias ${pass(t.reactionBias)}   track ${pass(t.trackedTimeRate)}   fps ${pass(t.effectiveFps)}   (distractor FPs: ${c.count.distractorFalsePositives})`,
    );
  }
  lines.push('');
  lines.push(
    'note: the `peak` MAE/bias is scored vs the onset ground truth, so it shows the +150–300ms',
  );
  lines.push(
    '      turn-execution inflation that `onset` removes (§4.1); distances/lighting pool per §7.',
  );
  lines.push(
    '      cued-dir% counts a player who turns the WRONG WAY as a model miss, so it is valid for',
  );
  lines.push(
    '      A/B comparison but is NOT the §7 ≥95% acceptance bar — that needs hand-coded labels.',
  );
  lines.push('====================================================================');
  return lines.join('\n');
}
