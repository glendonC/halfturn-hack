import type { ScanEvent, TrackingQuality } from './types';

/**
 * The single seam camera verification plugs into.
 *
 * The drill engine calls `getPoseVerifier()` once; if `available` is false (the
 * no-camera default) it simply never populates session-level verification. The real
 * implementation (VisionCamera + MediaPipe Pose Landmarker, behind a custom dev
 * client) must NOT be imported anywhere the Expo Go bundle reaches — see
 * getPoseVerifierAsync().
 */
export interface PoseVerifier {
  /** True only when a real camera pipeline is wired (false when no camera is wired). */
  readonly available: boolean;
  /** Backend/model identity (`"<id>@<version>"`) stamped into provenance. */
  readonly engine?: string;
  /** Begin sampling. `sessionT0Mono` anchors the drill-clock axis. */
  start(sessionT0Mono: number): void;
  /**
   * Pause sampling (optional). The drill clock excludes paused time, so a real
   * verifier must stop emitting samples here and re-anchor on {@link resume} —
   * otherwise scan timestamps drift ahead of cue onsets by the paused duration.
   */
  pause?(): void;
  /** Resume sampling after a {@link pause}, re-anchoring the clock. Optional. */
  resume?(): void;
  /** Stop sampling and resolve the detected scan timeline. */
  stop(): Promise<ScanEvent[]>;
  /**
   * Per-run tracking-quality provenance, available AFTER {@link stop}.
   * Optional + additive: NullPoseVerifier omits it.
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
