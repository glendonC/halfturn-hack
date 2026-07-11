/**
 * RealPoseVerifier — PerceptionBackend + YawFusion + detectScans behind the
 * frozen PoseVerifier seam (calibrateBaseline / verifyCue).
 *
 * Also buffers fused yaw samples while started so the drill store can pass
 * them into verifyCue. Expo Go never constructs this (getPoseVerifierAsync
 * returns NullPoseVerifier when canUseNativeVision is false).
 */

import { DEFAULT_REACTION_WINDOW_MS } from '@/constants';
import type {
  PoseVerifier,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

import type { PerceptionBackend, RawPoseFrame } from './PerceptionBackend';
import { detectScans } from './scanDetect';
import {
  DEFAULT_CALIBRATION,
  DEFAULT_SCAN_DETECT_CONFIG,
  type CalibrationProfile,
  type PoseSample,
  type ScanDetectConfig,
} from './types';
import { fuse } from './YawFusion';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export class RealPoseVerifier implements PoseVerifier {
  private baselineYawRad = 0;
  private poseSamples: PoseSample[] = [];
  private clockOffsetMs: number | null = null;
  private started = false;
  private paused = false;

  constructor(
    private readonly backend: PerceptionBackend,
    private readonly calibration: CalibrationProfile = DEFAULT_CALIBRATION,
    private readonly cfg: ScanDetectConfig = DEFAULT_SCAN_DETECT_CONFIG,
  ) {}

  get available(): boolean {
    return this.backend.id !== 'null';
  }

  get backendId(): string {
    return `${this.backend.id}@${this.backend.version}`;
  }

  /** Begin sampling from the perception backend onto the drill-clock axis. */
  start(sessionT0DrillMs = 0): void {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.poseSamples = [];
    this.clockOffsetMs = null;
    this.backend.onRawPose((raw) => this.handleFrame(raw, sessionT0DrillMs));
    this.backend.start();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.backend.stop();
    this.started = false;
    this.paused = false;
  }

  /** Buffered yaw samples for verifyCue (radians, drill clock). */
  getYawSamples(): YawSample[] {
    const nowWall = Date.now();
    return this.poseSamples.map((s) => ({
      drillMs: s.tMonoMs,
      wallMs: nowWall,
      yaw: s.yawDeg * DEG_TO_RAD,
      confidence: s.confidence,
    }));
  }

  calibrateBaseline(samples: YawSample[]): void {
    if (samples.length === 0) {
      this.baselineYawRad = 0;
      return;
    }
    const sum = samples.reduce((a, s) => a + s.yaw, 0);
    this.baselineYawRad = sum / samples.length;
  }

  verifyCue(args: VerifyCueArgs): VerificationResult {
    const samples =
      args.samples.length > 0 ? args.samples : this.getYawSamples();
    if (samples.length === 0) {
      return { outcome: 'unknown', backendId: this.backendId };
    }

    const early = args.windowMs.early;
    const late = args.windowMs.late;
    const cueOnset = args.cueOnsetDrillMs;
    const windowStart = cueOnset - early;
    const windowEnd = cueOnset + late;

    const pose = samples
      .filter((s) => s.drillMs >= windowStart && s.drillMs <= windowEnd)
      .filter((s) => s.confidence >= this.cfg.minConfidence)
      .map(
        (s): PoseSample => ({
          tMonoMs: s.drillMs,
          yawDeg: (s.yaw - this.baselineYawRad) * RAD_TO_DEG,
          confidence: s.confidence,
        }),
      );

    if (pose.length < 2) {
      return { outcome: 'unknown', backendId: this.backendId };
    }

    const scans = detectScans(pose, this.cfg);
    if (scans.length === 0) {
      return { outcome: 'missed', backendId: this.backendId };
    }

    // Prefer the first scan whose peak is at/after cue onset within the late window.
    const after = scans.find(
      (s) => s.tMonoMs >= cueOnset && s.tMonoMs - cueOnset <= late,
    );
    if (after) {
      const onset = after.onsetMonoMs ?? after.startMonoMs ?? after.tMonoMs;
      const reactionMs = onset - cueOnset;
      if (reactionMs < -early) {
        return {
          outcome: 'anticipated',
          onsetDrillMs: onset,
          reactionMs,
          peakExcursion: Math.abs(after.peakYawDeg),
          confidence: after.confidence,
          backendId: this.backendId,
        };
      }
      return {
        outcome: 'verified',
        onsetDrillMs: onset,
        reactionMs,
        peakExcursion: Math.abs(after.peakYawDeg),
        confidence: after.confidence,
        backendId: this.backendId,
      };
    }

    // Scan entirely before cue → anticipation.
    const before = scans.find((s) => s.tMonoMs < cueOnset);
    if (before) {
      const onset = before.onsetMonoMs ?? before.startMonoMs ?? before.tMonoMs;
      return {
        outcome: 'anticipated',
        onsetDrillMs: onset,
        reactionMs: onset - cueOnset,
        peakExcursion: Math.abs(before.peakYawDeg),
        confidence: before.confidence,
        backendId: this.backendId,
      };
    }

    return { outcome: 'missed', backendId: this.backendId };
  }

  private handleFrame(raw: RawPoseFrame, sessionT0DrillMs: number): void {
    if (this.paused) return;
    if (this.clockOffsetMs == null) {
      this.clockOffsetMs = raw.captureClockMs - sessionT0DrillMs;
    }
    const fused = fuse(raw, this.calibration);
    this.poseSamples.push({
      tMonoMs: fused.captureClockMs - this.clockOffsetMs,
      yawDeg: fused.yawDeg,
      confidence: fused.confidence,
    });
  }
}

export function isRealPoseVerifier(
  v: PoseVerifier,
): v is RealPoseVerifier {
  return v instanceof RealPoseVerifier;
}

/** Default reaction window for verifyCue when the store does not override. */
export const DEFAULT_VERIFY_WINDOW_MS = DEFAULT_REACTION_WINDOW_MS;
