import type { PoseSample, ScanEvent, TrackingQuality } from './types';

/**
 * The single seam camera verification plugs into.
 *
 * The drill engine calls `getPoseVerifier()` once; if `available` is false (the
 * no-camera default) it simply never populates `DrillSession.verification`. The real
 * implementation (VisionCamera + MediaPipe Pose Landmarker, behind a custom dev
 * client) will live in a separate module and must NOT be imported anywhere the
 * Expo Go bundle reaches — see getPoseVerifier().
 */
export interface PoseVerifier {
  /** True only when a real camera pipeline is wired (false when no camera is wired). */
  readonly available: boolean;
  /** Backend/model identity (`"<id>@<version>"`) stamped into provenance. */
  readonly engine?: string;
  /**
   * The |yaw| band this run treats as "back at neutral" for cue gating (deg). The verifier owns it
   * because it is a PERCEPTION tuning — scaled from the player's measured noise floor when their
   * calibration carries one (`thresholdAdapt.deriveNeutralMaxYawDeg`), so the drill behavior can ask
   * rather than reach into the calibration store. Omitted ⇒ callers use the fixed `CUE_GATE` band.
   */
  readonly neutralMaxYawDeg?: number;
  /** Begin sampling. `sessionT0Mono` anchors the drill-clock axis. */
  start(sessionT0Mono: number): void;
  /**
   * Pause sampling (optional). The drill clock excludes paused time, so a real
   * verifier must stop emitting samples here and re-anchor on {@link resume} —
   * otherwise scan timestamps drift ahead of `CueEvent.firedAtMonoMs` by the
   * paused duration. No-op for verifiers that don't sample.
   */
  pause?(): void;
  /** Resume sampling after a {@link pause}, re-anchoring the clock. Optional. */
  resume?(): void;
  /**
   * Subscribe to scans as they complete DURING the run (optional). Drives the
   * live "turn verified" feedback loop; UX-only — the authoritative timeline is
   * still the one {@link stop} resolves. Verifiers that don't sample omit it.
   */
  onScan?(cb: (scan: ScanEvent) => void): void;
  /**
   * Most recent live sample (optional) — the "where is the player RIGHT NOW"
   * readout behind cue gating (hold a due cue until the player has reset).
   * Null before the first frame; stale while paused (frames are dropped).
   */
  latest?(): PoseSample | null;
  /** Stop sampling and resolve the detected scan timeline. */
  stop(): Promise<ScanEvent[]>;
  /**
   * Per-run tracking-quality provenance, available AFTER {@link stop} (reliability gating,
   * §5). Optional + additive: verifiers that don't sample (NullPoseVerifier) omit it, and
   * the drill engine treats a missing value as "no quality data."
   */
  quality?(): TrackingQuality | null;
}

/** No-op verifier used when no camera is wired. start/stop do nothing; stop resolves []. */
export class NullPoseVerifier implements PoseVerifier {
  readonly available = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  start(_sessionT0Mono: number): void {
    /* no-op */
  }

  async stop(): Promise<ScanEvent[]> {
    return [];
  }
}
