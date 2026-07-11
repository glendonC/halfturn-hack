import type { DrillMs, WallMs } from './clocks';
import type { CueDefinition } from './cues';

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

export interface PerceptionBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(cb: (sample: YawSample | null) => void): () => void;
}

export interface VerifyCueArgs {
  cue: CueDefinition;
  cueOnsetDrillMs: DrillMs;
  samples: YawSample[];
  windowMs: { early: number; late: number };
}

export interface PoseVerifier {
  calibrateBaseline(samples: YawSample[]): void;
  verifyCue(args: VerifyCueArgs): VerificationResult;
}
