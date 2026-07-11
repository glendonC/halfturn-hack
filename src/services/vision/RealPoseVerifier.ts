/**
 * Composes a swappable PerceptionBackend + pure YawFusion + pure detectScans
 * into the production PoseVerifier seam (start / stop → ScanEvent[]).
 *
 * Clock normalization: capture-clock → drill-clock offset anchors on the first
 * live frame. Pause drops frames and re-anchors on resume so paused wall time
 * is excluded (matches the drill clock).
 *
 * Expo Go never constructs this (getPoseVerifierAsync → NullPoseVerifier).
 */

import type { BackendStartConfig, PerceptionBackend, RawPoseFrame } from './PerceptionBackend';
import type { PoseVerifier } from './PoseVerifier';
import { smoothPoseSamples } from './sampleSmoothing';
import { computeTrackingQuality, detectScans } from './scanDetect';
import {
  DEFAULT_CALIBRATION,
  DEFAULT_SCAN_DETECT_CONFIG,
  type CalibrationProfile,
  type EnrichmentConfig,
  type PoseSample,
  type ScanDetectConfig,
  type ScanEvent,
  type TrackingQuality,
} from './types';
import { fuse } from './YawFusion';

/** Default enrichment: no smoothing, peak reaction (production DEFAULT_ENRICHMENT). */
export const DEFAULT_ENRICHMENT: EnrichmentConfig = {
  smoothing: null,
  reactionMode: 'peak',
};

/**
 * Composes a swappable PerceptionBackend + the pure YawFusion + the pure
 * detectScans into a PoseVerifier. Backend-agnostic: works with NullBackend
 * today and native MediaPipe/MoveNet backends in a dev build, unchanged.
 */
export class RealPoseVerifier implements PoseVerifier {
  private samples: PoseSample[] = [];
  private clockOffsetMs: number | null = null;
  private started = false;
  private paused = false;
  /** Most recent frame's capture clock (tracked even while paused). */
  private lastCaptureClockMs: number | null = null;
  /** Capture clock at the moment pause() was called (the last live frame). */
  private pausedAtCaptureClockMs: number | null = null;
  /** Set on resume; the next live frame folds the paused span into the offset. */
  private pendingResumeReanchor = false;
  /** Per-run tracking quality, computed at stop() for the metrics layer. */
  private lastQuality: TrackingQuality | null = null;

  constructor(
    private readonly backend: PerceptionBackend,
    private readonly calibration: CalibrationProfile = DEFAULT_CALIBRATION,
    private readonly cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
    private readonly startCfg?: BackendStartConfig,
    private readonly enrichment: EnrichmentConfig = DEFAULT_ENRICHMENT,
  ) {}

  get available(): boolean {
    return this.backend.id !== 'null';
  }

  get engine(): string {
    return `${this.backend.id}@${this.backend.version}`;
  }

  start(sessionT0Mono: number): void {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.samples = [];
    this.clockOffsetMs = null;
    this.lastCaptureClockMs = null;
    this.pausedAtCaptureClockMs = null;
    this.pendingResumeReanchor = false;
    this.lastQuality = null;
    this.backend.onRawPose((raw) => this.handleFrame(raw, sessionT0Mono));
    this.backend.start(this.startCfg);
  }

  pause(): void {
    if (!this.started || this.paused) return;
    this.paused = true;
    this.pausedAtCaptureClockMs = this.lastCaptureClockMs;
  }

  resume(): void {
    if (!this.started || !this.paused) return;
    this.paused = false;
    if (this.pausedAtCaptureClockMs != null) this.pendingResumeReanchor = true;
  }

  private handleFrame(raw: RawPoseFrame, sessionT0Mono: number): void {
    this.lastCaptureClockMs = raw.captureClockMs;
    if (this.paused) return;

    if (this.clockOffsetMs == null) {
      this.clockOffsetMs = raw.captureClockMs - sessionT0Mono;
    }
    if (this.pendingResumeReanchor && this.pausedAtCaptureClockMs != null) {
      this.clockOffsetMs += raw.captureClockMs - this.pausedAtCaptureClockMs;
      this.pendingResumeReanchor = false;
    }

    const r = fuse(raw, this.calibration);
    this.samples.push({
      tMonoMs: r.captureClockMs - this.clockOffsetMs,
      yawDeg: r.yawDeg,
      confidence: r.confidence,
      torsoYawDeg: r.torsoYawDeg,
      hipYawDeg: r.hipYawDeg,
      shoulderHipSepDeg: r.shoulderHipSepDeg,
      hipConfidence: r.hipConfidence,
      faceVis: r.faceVis,
    });
  }

  async stop(): Promise<ScanEvent[]> {
    this.backend.stop();
    this.started = false;
    this.paused = false;

    const detectInput = this.enrichment.smoothing
      ? smoothPoseSamples(this.samples, this.enrichment.smoothing)
      : this.samples;
    const scans = detectScans(detectInput, this.cfg);
    this.lastQuality = computeTrackingQuality(this.samples, this.cfg);
    return scans;
  }

  quality(): TrackingQuality | null {
    return this.lastQuality;
  }
}

export function isRealPoseVerifier(v: PoseVerifier): v is RealPoseVerifier {
  return v instanceof RealPoseVerifier;
}
