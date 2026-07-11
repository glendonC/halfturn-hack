/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports here — ever on the audio path.
 * Real backends land behind createPoseVerifier() in a later phase.
 */

export type VerificationOutcome =
  | 'verified'
  | 'missed'
  | 'anticipated'
  | 'unknown';

export interface VerificationResult {
  outcome: VerificationOutcome;
  onsetDrillMs?: number;
  reactionMs?: number;
  peakExcursion?: number;
  confidence?: number;
  backendId: string;
}

export interface PoseVerifier {
  calibrateBaseline(samples: unknown[]): void;
  verifyCue(args: unknown): VerificationResult;
}

/** Always available — Expo Go / audio-only / tests */
export class NullPoseVerifier implements PoseVerifier {
  calibrateBaseline(): void {}

  verifyCue(): VerificationResult {
    return { outcome: 'unknown', backendId: 'null' };
  }
}

export function createPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}
