/**
 * Pure scan detection over a yaw sample stream.
 * No camera / native imports — unit-testable with synthetic traces.
 */

import type { CueEvent, ScanMetrics, ScanVerification } from '@/types';

import {
  DEFAULT_SCAN_DETECT_CONFIG,
  type PoseSample,
  type ScanDetectConfig,
  type ScanEvent,
  type TrackingQuality,
} from './types';

const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Cue ids that represent an "action moment" to scan before. */
const ACTION_CUES = new Set(['turn', 'man_on', 'open_body']);

function computeScanEnrichment(
  valid: PoseSample[],
  enterIdx: number,
  peakIdx: number,
  exitIdx: number,
  peakYaw: number,
): { onsetMonoMs: number; excursionDeg: number; peakVel: number } {
  const enterT = valid[enterIdx]!.tMonoMs;

  let riseStart = enterIdx;
  while (riseStart > 0) {
    const prev = valid[riseStart - 1]!;
    const cur = valid[riseStart]!;
    if (
      sign(prev.yawDeg) === sign(peakYaw) &&
      Math.abs(prev.yawDeg) < Math.abs(cur.yawDeg)
    ) {
      riseStart -= 1;
    } else break;
  }

  let bestVel = 0;
  let bestT = enterT;
  let bestYaw = valid[enterIdx]!.yawDeg;
  let peakVel = 0;
  let excursionDeg = 0;
  for (let k = riseStart + 1; k <= exitIdx; k += 1) {
    const dtSec = (valid[k]!.tMonoMs - valid[k - 1]!.tMonoMs) / 1000;
    const dYaw = valid[k]!.yawDeg - valid[k - 1]!.yawDeg;
    excursionDeg += Math.abs(dYaw);
    if (dtSec <= 0) continue;
    const v = dYaw / dtSec;
    if (Math.abs(v) > Math.abs(peakVel)) peakVel = v;
    if (k <= peakIdx && Math.abs(v) > Math.abs(bestVel)) {
      bestVel = v;
      bestT = valid[k]!.tMonoMs;
      bestYaw = valid[k]!.yawDeg;
    }
  }

  let onsetMonoMs = enterT;
  if (bestVel !== 0) {
    const raw = bestT - (bestYaw / bestVel) * 1000;
    onsetMonoMs = Math.min(Math.max(raw, valid[riseStart]!.tMonoMs), enterT);
  }

  return { onsetMonoMs, excursionDeg, peakVel: Math.abs(peakVel) };
}

/**
 * Enter/exit hysteresis + hold debounce + refractory period.
 * Stops ball-watching head-bobs from counting as shoulder checks.
 */
export function detectScans(
  samples: PoseSample[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
): ScanEvent[] {
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
    const s = valid[i]!;
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

    if (mag > Math.abs(peakYaw)) {
      peakYaw = s.yawDeg;
      peakIdx = i;
      peakAt = s.tMonoMs;
      peakConfidence = s.confidence;
    }

    if (mag <= cfg.yawExitDeg) {
      const held = s.tMonoMs - valid[enterIdx]!.tMonoMs;
      if (held >= cfg.minHoldMs) {
        const enrich = computeScanEnrichment(valid, enterIdx, peakIdx, i, peakYaw);
        scans.push({
          tMonoMs: peakAt,
          direction: peakYaw < 0 ? 'left' : 'right',
          peakYawDeg: peakYaw,
          startMonoMs: valid[enterIdx]!.tMonoMs,
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

export function computeTrackingQuality(
  samples: PoseSample[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
): TrackingQuality {
  const n = samples.length;
  if (n === 0) {
    return { trackedTimeRate: 0, meanPoseConfidence: 0, effectiveFps: 0 };
  }
  let confSum = 0;
  let tracked = 0;
  for (const s of samples) {
    confSum += s.confidence;
    if (s.confidence >= cfg.minConfidence) tracked += 1;
  }
  const spanMs = samples[n - 1]!.tMonoMs - samples[0]!.tMonoMs;
  const fps = n >= 2 && spanMs > 0 ? ((n - 1) / spanMs) * 1000 : 0;
  return {
    trackedTimeRate: Math.round((tracked / n) * 100) / 100,
    meanPoseConfidence: Math.round((confSum / n) * 100) / 100,
    effectiveFps: Math.round(fps * 10) / 10,
  };
}

/**
 * Reduce detected scans + cue timeline into hack ScanMetrics.
 * Peak-anchored reaction; null-honest when evidence is missing.
 */
export function computeScanMetrics(
  scans: ScanEvent[],
  cues: readonly CueEvent[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
): ScanMetrics {
  const left = scans.filter((s) => s.direction === 'left').length;
  const right = scans.filter((s) => s.direction === 'right').length;
  const directional = left + right;
  const blindSideBalance =
    directional > 0 ? (left - right) / directional : null;

  const actionCues = cues.filter((c) => ACTION_CUES.has(c.cueId));
  let scannedBefore = 0;
  for (const cue of actionCues) {
    const had = scans.some(
      (s) =>
        s.tMonoMs <= cue.onsetDrillMs &&
        cue.onsetDrillMs - s.tMonoMs <= cfg.scanBeforeWindowMs,
    );
    if (had) scannedBefore += 1;
  }
  const scannedBeforeActionRate =
    actionCues.length > 0 ? scannedBefore / actionCues.length : null;

  const reactions: number[] = [];
  for (const cue of cues) {
    const next = scans.find(
      (s) =>
        s.tMonoMs >= cue.onsetDrillMs &&
        s.tMonoMs - cue.onsetDrillMs <= cfg.scanBeforeWindowMs,
    );
    if (next) reactions.push(next.tMonoMs - cue.onsetDrillMs);
  }
  const meanReactionMs =
    reactions.length > 0
      ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length)
      : null;

  return {
    metricsVersion: 1,
    scannedBeforeActionRate,
    blindSideBalance,
    meanReactionMs,
    anticipationRate: null,
  };
}

/**
 * Map scan timeline + cues into production ScanVerification (peak mode).
 * Full onset-mode computeScanVerification lands with the scanDetect lift (#30).
 */
export function toScanVerification(
  scans: ScanEvent[],
  cues: readonly CueEvent[],
  actualDurationSec: number,
  engineLabel: string,
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  quality?: TrackingQuality | null,
): ScanVerification {
  const minutes = Math.max(actualDurationSec / 60, 1 / 60);
  const leftScans = scans.filter((s) => s.direction === 'left').length;
  const rightScans = scans.filter((s) => s.direction === 'right').length;
  const metrics = computeScanMetrics(scans, cues, cfg);
  const base: ScanVerification = {
    metricsVersion: 1,
    scansDetected: scans.length,
    scansPerMinute: Math.round((scans.length / minutes) * 10) / 10,
    leftScans,
    rightScans,
    avgReactionMs: metrics.meanReactionMs,
    scannedBeforeActionRate: metrics.scannedBeforeActionRate,
    engine: engineLabel,
    anticipationRate: metrics.anticipationRate,
  };
  if (quality) {
    base.trackedTimeRate = quality.trackedTimeRate;
    base.meanPoseConfidence = quality.meanPoseConfidence;
    base.effectiveFps = quality.effectiveFps;
  }
  return base;
}
