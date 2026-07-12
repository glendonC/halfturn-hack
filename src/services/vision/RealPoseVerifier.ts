import { CUE_GATE } from '@/constants/visionTuning';

import { CAPTURE_ENABLED, recordVerifierRun } from './frameCapture';
import type { BackendStartConfig, PerceptionBackend, RawPoseFrame } from './PerceptionBackend';
import type { PoseVerifier } from './PoseVerifier';
import { smoothPoseSamples } from './sampleSmoothing';
import { computeTrackingQuality, detectScans } from './scanDetect';
import {
  DEFAULT_ENRICHMENT,
  DEFAULT_SCAN_DETECT_CONFIG,
  type CalibrationProfile,
  type EnrichmentConfig,
  type PoseSample,
  type ScanDetectConfig,
  type ScanEvent,
  type TrackingQuality,
} from './types';
import { fuse } from './YawFusion';

/**
 * Composes a swappable PerceptionBackend + the pure YawFusion + the pure
 * detectScans into a PoseVerifier. Backend-agnostic: it works with NullBackend
 * today and the native MediaPipe/MoveNet backends in a dev build, UNCHANGED.
 *
 * Clock normalization (the load-bearing detail): the offset between the native
 * capture clock and the drill clock is anchored ONCE from the first frame, so
 * scan timestamps land on the same axis as CueEvent.firedAtMonoMs and reaction
 * time stays a pure subtraction. See docs/perception-architecture.md §3.
 *
 * Pause handling (the second load-bearing detail): the engine's drill clock
 * EXCLUDES paused time (`pausedAccum`), but the capture clock keeps advancing
 * through a pause. So while paused we drop frames (no phantom scans across the
 * gap) and, on resume, fold the paused capture-clock span into the offset — the
 * same "exclude paused time" the engine applies to cues. This keeps
 * `scan.tMonoMs` aligned with `CueEvent.firedAtMonoMs` after a pause/resume.
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
  /** Live-scan subscriber (UX feedback loop); see onScan(). */
  private scanCb: ((scan: ScanEvent) => void) | null = null;
  /** How many completed scans have already been emitted live. */
  private emittedScans = 0;
  /** Frame counter for throttling live detection. */
  private frameCount = 0;

  constructor(
    private readonly backend: PerceptionBackend,
    private readonly calibration: CalibrationProfile,
    private readonly cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
    private readonly startCfg?: BackendStartConfig,
    /** Body-signal enrichment toggles (§9). Default OFF = today's behavior. */
    private readonly enrichment: EnrichmentConfig = DEFAULT_ENRICHMENT,
    /**
     * Cue-gate "back at neutral" band (deg). Resolved by the caller alongside `cfg` so the two
     * always agree — a band wider than the scan threshold would let a player be simultaneously
     * "at neutral" and "turning". Defaults to the fixed `CUE_GATE` band.
     */
    readonly neutralMaxYawDeg: number = CUE_GATE.neutralMaxYawDeg,
  ) {}

  get available(): boolean {
    return this.backend.id !== 'null';
  }

  get engine(): string {
    return `${this.backend.id}@${this.backend.version}`;
  }

  /**
   * Live scan feed: `handleFrame` re-runs the pure detector on the growing
   * sample stream (throttled) and emits each newly COMPLETED scan — a scan
   * exists only once yaw has re-crossed the exit threshold, so an emit lands
   * right as the player finishes the turn. The detector is causal (hysteresis
   * over a prefix never un-detects a scan), so count-diffing is sound. UX-only:
   * live detection runs on RAW samples, while stop() may apply the smoothing
   * enrichment — the timeline stop() returns stays authoritative.
   */
  onScan(cb: (scan: ScanEvent) => void): void {
    this.scanCb = cb;
  }

  /** Most recent live sample (null before the first frame / after start reset). */
  latest(): PoseSample | null {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1] : null;
  }

  start(sessionT0Mono: number): void {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.samples = [];
    this.emittedScans = 0;
    this.frameCount = 0;
    this.clockOffsetMs = null;
    this.lastCaptureClockMs = null;
    this.pausedAtCaptureClockMs = null;
    this.pendingResumeReanchor = false;
    this.backend.onRawPose((raw) => this.handleFrame(raw, sessionT0Mono));
    this.backend.start(this.startCfg);
  }

  pause(): void {
    if (!this.started || this.paused) return;
    this.paused = true;
    // Anchor the pause to the last live frame; the resume re-anchor excludes the
    // span between here and the first frame after resume.
    this.pausedAtCaptureClockMs = this.lastCaptureClockMs;
  }

  resume(): void {
    if (!this.started || !this.paused) return;
    this.paused = false;
    if (this.pausedAtCaptureClockMs != null) this.pendingResumeReanchor = true;
  }

  private handleFrame(raw: RawPoseFrame, sessionT0Mono: number): void {
    this.lastCaptureClockMs = raw.captureClockMs;
    // Drop frames while paused so no scan can span the pause gap.
    if (this.paused) return;

    // Anchor capture-clock -> drill-clock once, on the first LIVE frame: it maps
    // to the drill-clock value at start (sessionT0Mono, typically 0 at
    // beginRunning).
    if (this.clockOffsetMs == null) {
      this.clockOffsetMs = raw.captureClockMs - sessionT0Mono;
    }
    // First live frame after a resume: fold the paused capture-clock span into
    // the offset so paused time is excluded from tMonoMs (matches the engine).
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

    // Live feedback: every 3rd frame (~5Hz at the 15fps cap), detect and emit
    // newly completed scans. detectScans is O(n) arithmetic — cheap at this rate.
    this.frameCount += 1;
    if (this.scanCb && this.frameCount % 3 === 0) {
      const scans = detectScans(this.samples, this.cfg);
      for (; this.emittedScans < scans.length; this.emittedScans += 1) {
        this.scanCb(scans[this.emittedScans]);
      }
    }
  }

  async stop(): Promise<ScanEvent[]> {
    this.backend.stop();
    this.started = false;
    this.paused = false;

    // Enrichment (§9), off by default: One-Euro smoothing alters the DETECTION stream
    // (which scans), so it is applied only when configured. Tracking quality is measured
    // on the RAW samples (pre-smoothing) so it reflects the actual tracking, not the filter.
    const detectInput = this.enrichment.smoothing
      ? smoothPoseSamples(this.samples, this.enrichment.smoothing)
      : this.samples;
    const scans = detectScans(detectInput, this.cfg);
    this.lastQuality = computeTrackingQuality(this.samples, this.cfg);

    // Dev-only: stash the DERIVED trace (yaw samples + scans, never landmarks) for
    // the engine's finalize() to complete with the cue timeline. Inert unless the
    // capture flag is set — see frameCapture.ts.
    if (CAPTURE_ENABLED) {
      recordVerifierRun({
        engineLabel: this.engine,
        calibration: this.calibration,
        scanDetectConfig: this.cfg,
        enrichment: this.enrichment,
        samples: this.samples,
        scans,
      });
    }
    return scans;
  }

  quality(): TrackingQuality | null {
    return this.lastQuality;
  }
}
