/**
 * scanDetect (field names adapted to hack CueEvent:
 * onsetDrillMs / index instead of firedAtMonoMs / seq).
 */

import type { CueEvent, ScanVerification } from '@/types';
import {
  DEFAULT_SCAN_DETECT_CONFIG,
  type PoseSample,
  type ReactionMode,
  type ScanDetectConfig,
  type ScanEvent,
  type TrackingQuality,
} from './types';

const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);

/**
 * Enrichment computed alongside a confirmed scan (docs/scan-tracking-architecture.md §4).
 * MEASURED-ONLY — these never change which scans are detected.
 *  - `onsetMonoMs`: movement onset, velocity back-extrapolated to the neutral crossing.
 *  - `excursionDeg`: ∫|Δyaw| across the rise→exit window (turn-size discriminator).
 *  - `peakVel`: peak angular velocity across the window (deg/s), under-estimated at 15fps.
 */
function computeScanEnrichment(
  valid: PoseSample[],
  enterIdx: number,
  peakIdx: number,
  exitIdx: number,
  peakYaw: number,
): { onsetMonoMs: number; excursionDeg: number; peakVel: number } {
  const enterT = valid[enterIdx].tMonoMs;

  // Walk back from the enter crossing along the same-sign rising edge to its foot.
  let riseStart = enterIdx;
  while (riseStart > 0) {
    const prev = valid[riseStart - 1];
    const cur = valid[riseStart];
    if (sign(prev.yawDeg) === sign(peakYaw) && Math.abs(prev.yawDeg) < Math.abs(cur.yawDeg)) {
      riseStart -= 1;
    } else break;
  }

  // Peak rising velocity (steepest, most reliable slope) → back-extrapolate to yaw = 0.
  let bestVel = 0;
  let bestT = enterT;
  let bestYaw = valid[enterIdx].yawDeg;
  let peakVel = 0;
  let excursionDeg = 0;
  for (let k = riseStart + 1; k <= exitIdx; k += 1) {
    const dtSec = (valid[k].tMonoMs - valid[k - 1].tMonoMs) / 1000;
    const dYaw = valid[k].yawDeg - valid[k - 1].yawDeg;
    excursionDeg += Math.abs(dYaw);
    if (dtSec <= 0) continue;
    const v = dYaw / dtSec;
    if (Math.abs(v) > Math.abs(peakVel)) peakVel = v;
    // Only the rising edge (up to the peak) informs the onset slope.
    if (k <= peakIdx && Math.abs(v) > Math.abs(bestVel)) {
      bestVel = v;
      bestT = valid[k].tMonoMs;
      bestYaw = valid[k].yawDeg;
    }
  }

  // Line through (bestT, bestYaw) with slope bestVel hits yaw = 0 at the onset; clamp to
  // [rise foot, enter]. Falls back to the enter crossing when the rise is too short to fit.
  let onsetMonoMs = enterT;
  if (bestVel !== 0) {
    const raw = bestT - (bestYaw / bestVel) * 1000;
    onsetMonoMs = Math.min(Math.max(raw, valid[riseStart].tMonoMs), enterT);
  }

  return { onsetMonoMs, excursionDeg, peakVel: Math.abs(peakVel) };
}

/**
 * Turn a yaw sample stream into discrete scan events using enter/exit
 * hysteresis + a hold debounce + a refractory period. This is what stops
 * ball-watching head-bobs from being miscounted as shoulder checks.
 *
 * The decision logic (enter/exit/hold/refractory + peak anchor) is UNCHANGED; each
 * confirmed scan additionally carries measured-only enrichment (onset/excursion/velocity)
 * computed alongside, which never affects which scans are detected.
 */
export function detectScans(
  samples: PoseSample[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
): ScanEvent[] {
  // Confidence-passing subsequence (low-confidence samples were already skipped before;
  // materializing it lets the enrichment index back into the rising edge).
  const valid = samples.filter((s) => s.confidence >= cfg.minConfidence);

  const scans: ScanEvent[] = [];
  let inScan = false;
  let enterIdx = -1;
  let peakIdx = -1;
  let peakYaw = 0;
  let peakAt = 0;
  let peakConfidence = 0;
  let lastScanAt = -Infinity;

  for (let i = 0; i < valid.length; i += 1) {
    const s = valid[i];
    const mag = Math.abs(s.yawDeg);

    if (!inScan) {
      if (mag >= cfg.yawEnterDeg && s.tMonoMs - lastScanAt >= cfg.refractoryMs) {
        inScan = true;
        enterIdx = i;
        peakIdx = i;
        peakYaw = s.yawDeg;
        peakAt = s.tMonoMs;
        peakConfidence = s.confidence;
      }
      continue;
    }

    // in a scan — track the peak
    if (mag > Math.abs(peakYaw)) {
      peakYaw = s.yawDeg;
      peakIdx = i;
      peakAt = s.tMonoMs;
      peakConfidence = s.confidence;
    }

    if (mag <= cfg.yawExitDeg) {
      const held = s.tMonoMs - valid[enterIdx].tMonoMs;
      if (held >= cfg.minHoldMs) {
        const enrich = computeScanEnrichment(valid, enterIdx, peakIdx, i, peakYaw);
        scans.push({
          tMonoMs: peakAt, // recorded-metric anchor (peak)
          direction: peakYaw < 0 ? 'left' : 'right',
          peakYawDeg: peakYaw,
          startMonoMs: valid[enterIdx].tMonoMs, // yaw-enter crossing
          endMonoMs: s.tMonoMs,
          confidence: peakConfidence,
          onsetMonoMs: enrich.onsetMonoMs,
          excursionDeg: enrich.excursionDeg,
          peakAngularVelDegPerSec: enrich.peakVel,
        });
        lastScanAt = peakAt;
      }
      inScan = false;
    }
  }

  return scans;
}

/**
 * Per-run tracking-quality provenance (§5): fraction above the confidence gate, mean
 * confidence, effective fps. Rounded so it is stable across platforms. Pure.
 */
export function computeTrackingQuality(
  samples: PoseSample[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
): TrackingQuality {
  const n = samples.length;
  if (n === 0) return { trackedTimeRate: 0, meanPoseConfidence: 0, effectiveFps: 0 };
  let confSum = 0;
  let tracked = 0;
  for (const s of samples) {
    confSum += s.confidence;
    if (s.confidence >= cfg.minConfidence) tracked += 1;
  }
  const spanMs = samples[n - 1].tMonoMs - samples[0].tMonoMs;
  const fps = n >= 2 && spanMs > 0 ? ((n - 1) / spanMs) * 1000 : 0;
  return {
    trackedTimeRate: Math.round((tracked / n) * 100) / 100,
    meanPoseConfidence: Math.round((confSum / n) * 100) / 100,
    effectiveFps: Math.round(fps * 10) / 10,
  };
}

/** The reaction anchor for a scan: onset (honest) when present, else enter, else peak. */
function reactionAnchor(scan: ScanEvent): number {
  return scan.onsetMonoMs ?? scan.startMonoMs ?? scan.tMonoMs;
}

/** Linear-interpolated percentile over an ascending-sorted array (0 ≤ p ≤ 1). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Cue categories that represent an "action moment" to scan before. */
const ACTION_CUES = new Set(['turn', 'man_on', 'open_body']);

/** Defaults for the onset-reaction metrics (see docs/scan-tracking-architecture.md §4/§11). */
const DEFAULT_ANTICIPATION_WINDOW_MS = 800; // lookback for a pre-cue (gun-jumped) turn
const DEFAULT_ANTICIPATION_FLOOR_MS = 150; // sub-human RT floor; below this = anticipation
const DEFAULT_MIN_REACTION_SAMPLES = 3; // gray out reaction stats below this many

/** Optional enrichment inputs for the metrics layer. */
export interface ScanVerificationOptions {
  /** 'peak' (legacy, metricsVersion 1) or 'onset' (metricsVersion 2). Default 'peak'. */
  reactionMode?: ReactionMode;
  /** Provenance/trust signals to surface with the score (from computeTrackingQuality). */
  quality?: TrackingQuality;
  anticipationWindowMs?: number;
  anticipationFloorMs?: number;
  minReactionSamples?: number;
}

/**
 * Reduce detected scans + the cue timeline into the verification metrics the
 * History/Summary screens display. All temporal math is on the shared
 * drill-clock axis (tMonoMs vs CueEvent.onsetDrillMs).
 *
 * `reactionMode` (default 'peak') keeps today's peak-based `avgReactionMs` at
 * metricsVersion 1. In 'onset' mode `avgReactionMs` is measured cue→ONSET (removing
 * turn-execution contamination), the reaction distribution + `anticipationRate` populate,
 * and metricsVersion bumps to 2 so an onset blob is never silently compared to a peak one.
 */
export function computeScanVerification(
  scans: ScanEvent[],
  cues: CueEvent[],
  actualDurationSec: number,
  engineLabel: string,
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  opts: ScanVerificationOptions = {},
): ScanVerification {
  const reactionMode = opts.reactionMode ?? 'peak';
  const minutes = Math.max(actualDurationSec / 60, 1 / 60);
  const leftScans = scans.filter((s) => s.direction === 'left').length;
  const rightScans = scans.filter((s) => s.direction === 'right').length;

  // Scanned-before-action: action cues preceded by a scan within the window (peak anchor).
  const actionCues = cues.filter((c) => ACTION_CUES.has(c.cueId));
  let scannedBefore = 0;
  for (const cue of actionCues) {
    const had = scans.some(
      (s) => s.tMonoMs <= cue.onsetDrillMs && cue.onsetDrillMs - s.tMonoMs <= cfg.scanBeforeWindowMs,
    );
    if (had) scannedBefore += 1;
  }
  const scannedBeforeActionRate = actionCues.length > 0 ? scannedBefore / actionCues.length : null;

  const base: ScanVerification = {
    metricsVersion: reactionMode === 'onset' ? 2 : 1,
    scansDetected: scans.length,
    scansPerMinute: Math.round((scans.length / minutes) * 10) / 10,
    leftScans,
    rightScans,
    avgReactionMs: null,
    scannedBeforeActionRate,
    engine: engineLabel,
  };
  if (opts.quality) {
    base.trackedTimeRate = opts.quality.trackedTimeRate;
    base.meanPoseConfidence = opts.quality.meanPoseConfidence;
    base.effectiveFps = opts.quality.effectiveFps;
  }

  if (reactionMode === 'peak') {
    // Legacy: first scan after each cue, peak-anchored.
    const reactions: number[] = [];
    for (const cue of cues) {
      const next = scans.find(
        (s) =>
          s.tMonoMs >= cue.onsetDrillMs && s.tMonoMs - cue.onsetDrillMs <= cfg.scanBeforeWindowMs,
      );
      if (next) reactions.push(next.tMonoMs - cue.onsetDrillMs);
    }
    base.avgReactionMs =
      reactions.length > 0
        ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length)
        : null;
    return base;
  }

  // Onset mode: pair each cue to the nearest turn by ONSET within a gun-jump lookback +
  // the scan-before window; classify anticipation (turned before/with the cue or below the
  // sub-human RT floor) out of the reaction distribution but still counted as a turn.
  const antWindow = opts.anticipationWindowMs ?? DEFAULT_ANTICIPATION_WINDOW_MS;
  const antFloor = opts.anticipationFloorMs ?? DEFAULT_ANTICIPATION_FLOOR_MS;
  const minSamples = opts.minReactionSamples ?? DEFAULT_MIN_REACTION_SAMPLES;

  // One-to-one cue↔turn assignment: gather every in-window (cue, turn) candidate, then
  // greedily accept the closest pairs, consuming each cue AND each turn once. Independent
  // per-cue nearest matching would let closely-spaced cues both grab one physical turn
  // (double-counting a reaction as reaction+anticipation) or drop a real turn.
  const candidates: { cueIndex: number; scanIdx: number; rt: number }[] = [];
  cues.forEach((cue) => {
    scans.forEach((s, scanIdx) => {
      const rt = reactionAnchor(s) - cue.onsetDrillMs;
      if (rt >= -antWindow && rt <= cfg.scanBeforeWindowMs) {
        candidates.push({ cueIndex: cue.index, scanIdx, rt });
      }
    });
  });
  candidates.sort((a, b) => Math.abs(a.rt) - Math.abs(b.rt));

  const usedCues = new Set<number>();
  const usedScans = new Set<number>();
  let paired = 0;
  let anticipated = 0;
  const reactions: number[] = [];
  for (const c of candidates) {
    if (usedCues.has(c.cueIndex) || usedScans.has(c.scanIdx)) continue;
    usedCues.add(c.cueIndex);
    usedScans.add(c.scanIdx);
    paired += 1;
    // Turned before/with the cue or below the sub-human RT floor → anticipation (still a
    // counted turn, but excluded from the reaction distribution).
    if (c.rt < antFloor) anticipated += 1;
    else reactions.push(c.rt);
  }

  base.anticipationRate = paired > 0 ? anticipated / paired : null;

  if (reactions.length >= minSamples) {
    const sorted = [...reactions].sort((a, b) => a - b);
    base.avgReactionMs = Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length);
    base.medianReactionMs = Math.round(percentile(sorted, 0.5));
    base.reactionP25Ms = Math.round(percentile(sorted, 0.25));
    base.reactionP75Ms = Math.round(percentile(sorted, 0.75));
    base.reactionP90Ms = Math.round(percentile(sorted, 0.9));
    base.bestReactionMs = Math.round(sorted[0]);
  }

  return base;
}
