/**
 * DEV-ONLY derived-trace capture (validation instrumentation, see
 * docs/scan-tracking-architecture.md §7). It freezes a real on-device run into a
 * self-contained bundle so the pure detector/metrics can be A/B-ed and regression-
 * gated against a golden fixture — the data-first precondition for tuning YawFusion
 * and scanDetect without guessing.
 *
 * PRIVACY (load-bearing): this captures DERIVED signals only — the `PoseSample`
 * yaw stream, detected `ScanEvent`s, and the cue timeline — NEVER raw frames,
 * landmarks, or world coordinates. A `PoseSample` is a non-identifying scalar
 * (yaw degrees + confidence), consistent with the on-device/derived-only invariant;
 * a `RawPoseFrame` (a landmark stream) is exactly what must never persist or leave
 * the device, so it is never buffered here. Because the payload is derived scalars
 * (~7 numbers/frame, not ~99), it is also small enough to export dep-free.
 *
 * Pure + dependency-free (types + console only): no native imports, no Date.now
 * inside the pure helpers (timestamps are passed in), so it is Expo-Go-safe and the
 * existing guard (scripts/guard-expo-go.sh) already enforces that this non-allow-
 * listed file stays native-import-free.
 *
 * Reached ONLY behind `CAPTURE_ENABLED` at its call sites (RealPoseVerifier.stop +
 * the drill engine's finalize), so it is inert in production, Expo Go, and audio mode.
 */

import type { CueEvent } from '@/types';
import type {
  CalibrationProfile,
  EnrichmentConfig,
  PoseSample,
  ScanDetectConfig,
  ScanEvent,
} from './types';

/** Dev + explicit opt-in. Never set in production or Expo Go. */
export const CAPTURE_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_CAPTURE === '1';

/** Marker fence for the chunked-console export (parsed by scripts/collect-capture.mjs). */
export const CAPTURE_BEGIN = '[[HT-CAPTURE BEGIN]]';
export const CAPTURE_END = '[[HT-CAPTURE END]]';
const CHUNK_PREFIX = '[[HT-CAPTURE ';

/**
 * A self-contained, replayable derived capture. Everything `computeScanVerification`
 * consumes is frozen here (cues, duration, engine, cfg) alongside the derived sample
 * stream and detected scans — so a golden test can reproduce the exact output, and a
 * later A/B can re-score the same samples under new detector tuning. `synthetic`
 * distinguishes a scripted fixture from a real device capture.
 */
export interface DerivedCaptureBundle {
  synthetic: boolean;
  /** Wall-clock epoch ms when the capture was finalized (0 for scripted fixtures). */
  capturedAtEpochMs: number;
  /** Backend/model identity string (`RealPoseVerifier.engine`). */
  engineLabel: string;
  calibration: CalibrationProfile;
  scanDetectConfig: ScanDetectConfig;
  /**
   * Enrichment toggles active for the run. Recorded so the bundle stays self-reproducing:
   * when smoothing was on, `scans` came from the smoothed stream, so off-device re-scoring
   * must re-apply `enrichment.smoothing` to `samples` before detectScans. `samples` is
   * always the RAW derived stream (kept for re-tuning the filter params).
   */
  enrichment: EnrichmentConfig;
  /** DERIVED yaw stream on the drill clock — NOT raw landmarks. */
  samples: PoseSample[];
  scans: ScanEvent[];
  cues: CueEvent[];
  actualDurationSec: number;
}

type PendingRun = Pick<
  DerivedCaptureBundle,
  'engineLabel' | 'calibration' | 'scanDetectConfig' | 'enrichment' | 'samples' | 'scans'
>;

let pending: PendingRun | null = null;

/**
 * Stash the verifier's derived output (samples + detected scans + run meta). Called
 * from RealPoseVerifier.stop() behind CAPTURE_ENABLED; completed by
 * {@link finalizeCapture} once the engine has the cue timeline + duration.
 */
export function recordVerifierRun(run: PendingRun): void {
  pending = run;
}

/**
 * Complete the pending run into a bundle with the cue timeline + duration and clear
 * the buffer. Returns null if no run was recorded. Pure w.r.t. time — `nowEpochMs`
 * is passed in by the caller.
 */
export function finalizeCapture(
  cues: CueEvent[],
  actualDurationSec: number,
  nowEpochMs: number,
): DerivedCaptureBundle | null {
  if (!pending) return null;
  const bundle: DerivedCaptureBundle = {
    synthetic: false,
    capturedAtEpochMs: nowEpochMs,
    engineLabel: pending.engineLabel,
    calibration: pending.calibration,
    scanDetectConfig: pending.scanDetectConfig,
    enrichment: pending.enrichment,
    samples: pending.samples,
    scans: pending.scans,
    cues,
    actualDurationSec,
  };
  pending = null;
  return bundle;
}

/** Drop any buffered run (drill start / test teardown). */
export function resetCapture(): void {
  pending = null;
}

export function serializeBundle(bundle: DerivedCaptureBundle): string {
  return JSON.stringify(bundle);
}

/**
 * Split a serialized bundle into fenced, indexed console chunks. Pure. The fence +
 * `i/n` index lets scripts/collect-capture.mjs reassemble a full-length trace from a
 * copied Metro log with no size limit and no lossy downsampling (downsampling would
 * corrupt the temporally load-bearing detector: minHold/refractory live at ~66ms).
 */
export function toCaptureChunks(json: string, chunkSize = 7500): string[] {
  const bodies: string[] = [];
  for (let i = 0; i < json.length; i += chunkSize) bodies.push(json.slice(i, i + chunkSize));
  const n = bodies.length;
  const lines = bodies.map((b, i) => `${CHUNK_PREFIX}${i + 1}/${n}]]${b}`);
  return [CAPTURE_BEGIN, ...lines, CAPTURE_END];
}

/** Inverse of {@link toCaptureChunks}: reassemble the JSON from fenced chunk lines. Pure. */
export function fromCaptureChunks(lines: string[]): string {
  return lines
    .filter((l) => l.startsWith(CHUNK_PREFIX))
    .map((l) => l.slice(l.indexOf(']]') + 2))
    .join('');
}

/** Emit a bundle to the console as fenced chunks for off-device collection. */
export function emitCaptureToConsole(bundle: DerivedCaptureBundle): void {
  for (const line of toCaptureChunks(serializeBundle(bundle))) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
