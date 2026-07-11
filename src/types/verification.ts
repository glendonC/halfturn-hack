import type { DrillMs, WallMs } from './clocks';

/** Yaw in radians relative to session baseline (prefer radians everywhere). */
export interface YawSample {
  drillMs: DrillMs;
  wallMs: WallMs;
  yaw: number;
  confidence: number;
  occluded?: boolean;
}

export type VerificationOutcome =
  | 'verified'
  | 'missed'
  | 'anticipated'
  | 'unknown';

export interface VerificationResult {
  outcome: VerificationOutcome;
  onsetDrillMs?: DrillMs;
  /** onset - cue onset (drill clock); negative ⇒ anticipation */
  reactionMs?: number;
  peakExcursion?: number;
  confidence?: number;
  backendId: string;
}

/**
 * Optional YawSample stream adapter (ARCHITECTURE sketch).
 * Frame-level swappable backends live in services/vision/PerceptionBackend.
 */
export interface YawSampleBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(cb: (sample: YawSample | null) => void): () => void;
}
