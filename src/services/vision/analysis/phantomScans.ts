/**
 * Phantom-scan analysis — how many turns does the detector INVENT from a player who is standing
 * perfectly still?
 *
 * This exists because of a field measurement (docs/scan-tracking-architecture.md §10b): with the
 * player's back to the camera, derived torso yaw carries σ ≈ 8–21°, while
 * `DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg` — the threshold that declares a scan — is **28°**. That
 * is only ~1.3–3.5σ. So the neutral stance's own sensor noise may be crossing the scan threshold on
 * its own, and every downstream metric (`scansDetected`, direction balance, reaction times) would
 * be quietly polluted.
 *
 * Rather than guess, we replay the REAL measured noise through the FROZEN `detectScans` at drill
 * length and count what comes out. Any scan detected in a stationary stream is by definition a
 * phantom.
 *
 * Method — a moving-block bootstrap over the real residuals:
 *   1. Take a real captured back-turned window and subtract its circular median ⇒ the residuals a
 *      motionless player actually produced (this is exactly what `PoseSample.yawDeg` is: the yaw
 *      after the neutral baseline is subtracted).
 *   2. Resample those residuals in contiguous BLOCKS, not one at a time. Sensor noise is
 *      autocorrelated, and `detectScans` requires yaw to stay above the threshold for `minHoldMs`
 *      — so an i.i.d. shuffle would destroy the very runs that create phantoms and would flatter
 *      the result. Blocks preserve the run structure.
 *   3. Feed the synthesized stationary stream through the real detector.
 *
 * Pure + seeded ⇒ deterministic and testable. It measures the DETECTOR against real noise; it does
 * not model anything.
 */

import type { Rng } from '@/utils/random';

import { detectScans } from '../scanDetect';
import { smoothPoseSamples } from '../sampleSmoothing';
import type { OneEuroConfig } from '../OneEuroFilter';
import { DEFAULT_SCAN_DETECT_CONFIG, type PoseSample, type ScanDetectConfig } from '../types';
import { wrapDeg180 } from '../YawFusion';

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * A motionless player's yaw residuals, in degrees, recovered from a real captured window.
 * Circular: the back-turned stance sits on the ±180° seam, so the deviation must wrap.
 */
export function residualsFrom(realYawWindow: readonly number[]): number[] {
  let sin = 0;
  let cos = 0;
  for (const y of realYawWindow) {
    sin += Math.sin((y * Math.PI) / 180);
    cos += Math.cos((y * Math.PI) / 180);
  }
  const refDeg = (Math.atan2(sin, cos) * 180) / Math.PI;
  const deltas = realYawWindow.map((y) => wrapDeg180(y - refDeg));
  const med = median(deltas);
  return deltas.map((d) => d - med);
}

export interface StationaryStreamOptions {
  /** Real captured yaw windows (degrees) to draw the noise from. */
  realYawWindows: readonly (readonly number[])[];
  /** How long the simulated stationary drill runs. */
  durationSec: number;
  /** Sample period — ~100ms is the ~10fps actually observed on device. */
  periodMs?: number;
  /** Contiguous block length for the bootstrap; preserves noise autocorrelation. */
  blockLen?: number;
  /** Confidence to stamp; real captures were solidly in frame. */
  confidence?: number;
  rng: Rng;
}

/**
 * Synthesize a stationary (never-turning) yaw stream whose noise is drawn from real captures.
 * The true yaw is 0° throughout — the player does not move — so every scan the detector reports
 * over this stream is a phantom.
 */
export function stationaryStream({
  realYawWindows,
  durationSec,
  periodMs = 100,
  blockLen = 5,
  confidence = 0.9,
  rng,
}: StationaryStreamOptions): PoseSample[] {
  const pool: number[][] = realYawWindows.map((w) => residualsFrom(w));
  const n = Math.round((durationSec * 1000) / periodMs);
  const out: PoseSample[] = [];

  while (out.length < n) {
    const src = pool[Math.floor(rng() * pool.length) % pool.length];
    const start = Math.floor(rng() * src.length) % src.length;
    for (let k = 0; k < blockLen && out.length < n; k += 1) {
      const yawDeg = src[(start + k) % src.length]; // wrap the block around the window
      out.push({ tMonoMs: out.length * periodMs, yawDeg, confidence });
    }
  }
  return out;
}

export interface PhantomScanResult {
  durationSec: number;
  samples: number;
  /** Scans the detector reported. The player never turned, so all of them are false. */
  phantomScans: number;
  phantomsPerMin: number;
  /** Largest |yaw| the stationary noise reached, vs the enter threshold it had to clear. */
  peakAbsYawDeg: number;
  yawEnterDeg: number;
}

/** Count the turns the detector invents from a stationary stream. Pure. */
export function countPhantomScans(
  samples: PoseSample[],
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  smoothing: OneEuroConfig | null = null,
): PhantomScanResult {
  const input = smoothing ? smoothPoseSamples(samples, smoothing) : samples;
  const scans = detectScans(input, cfg);
  const spanMs = samples.length > 1 ? samples[samples.length - 1].tMonoMs - samples[0].tMonoMs : 0;
  const durationSec = spanMs / 1000;
  return {
    durationSec,
    samples: samples.length,
    phantomScans: scans.length,
    phantomsPerMin: durationSec > 0 ? (scans.length / durationSec) * 60 : 0,
    peakAbsYawDeg: input.reduce((m, s) => Math.max(m, Math.abs(s.yawDeg)), 0),
    yawEnterDeg: cfg.yawEnterDeg,
  };
}

export interface TurnTraceOptions extends Omit<StationaryStreamOptions, 'durationSec'> {
  /** Peak excursion. The field capture measured a real half-turn at ~133°: the drill REQUIRES it,
   *  since the player cannot read a screen behind them without coming that far around. */
  peakDeg?: number;
  /** When the turn starts, relative to the trace. */
  onsetMs?: number;
  /** Time to reach the peak, hold there, and return. */
  riseMs?: number;
  holdMs?: number;
  fallMs?: number;
  durationSec?: number;
}

/**
 * A REAL half-turn with the REAL back-turned noise superimposed on it. Used to check that a
 * candidate config still finds a genuine turn — a threshold that kills phantoms by refusing to
 * detect anything is not a fix. The turn is to the player's LEFT (negative yaw).
 */
export function turnTrace({
  peakDeg = 133,
  onsetMs = 3000,
  riseMs = 600,
  holdMs = 800,
  fallMs = 800,
  durationSec = 12,
  ...noiseOpts
}: TurnTraceOptions): { samples: PoseSample[]; trueOnsetMs: number } {
  const noise = stationaryStream({ ...noiseOpts, durationSec });
  const shape = (t: number): number => {
    if (t < onsetMs) return 0;
    if (t < onsetMs + riseMs) return -peakDeg * ((t - onsetMs) / riseMs);
    if (t < onsetMs + riseMs + holdMs) return -peakDeg;
    if (t < onsetMs + riseMs + holdMs + fallMs) {
      return -peakDeg * (1 - (t - onsetMs - riseMs - holdMs) / fallMs);
    }
    return 0;
  };
  return {
    samples: noise.map((s) => ({ ...s, yawDeg: shape(s.tMonoMs) + s.yawDeg })),
    trueOnsetMs: onsetMs,
  };
}

export interface OnsetPrecision {
  /** Traces (of `trials`) where exactly one scan was found, in the right direction. */
  cleanDetections: number;
  trials: number;
  /** Mean detected-onset error. A CONSTANT bias is subtractable and mostly harmless... */
  biasMs: number;
  /** ...it is the SPREAD that destroys reaction time, since a human reaction is only ~400-700ms. */
  sdMs: number;
}

/**
 * How precisely does the detector time a real turn's ONSET? This is the number that decides whether
 * `reactionMs` (onset − cueFiredAt) means anything at all.
 */
export function measureOnsetPrecision(
  makeTrace: (seed: number) => { samples: PoseSample[]; trueOnsetMs: number },
  cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  smoothing: OneEuroConfig | null = null,
  trials = 40,
): OnsetPrecision {
  const errs: number[] = [];
  let clean = 0;

  for (let seed = 0; seed < trials; seed += 1) {
    const { samples, trueOnsetMs } = makeTrace(seed);
    const input = smoothing ? smoothPoseSamples(samples, smoothing) : samples;
    const scans = detectScans(input, cfg);
    if (scans.length === 1 && scans[0].direction === 'left') clean += 1;

    const hit = scans.find((s) => s.direction === 'left');
    if (!hit) continue;
    errs.push((hit.onsetMonoMs ?? hit.startMonoMs ?? hit.tMonoMs) - trueOnsetMs);
  }

  if (errs.length === 0) return { cleanDetections: clean, trials, biasMs: NaN, sdMs: NaN };
  const biasMs = errs.reduce((a, b) => a + b, 0) / errs.length;
  const sdMs = Math.sqrt(errs.reduce((a, b) => a + (b - biasMs) ** 2, 0) / errs.length);
  return { cleanDetections: clean, trials, biasMs, sdMs };
}
