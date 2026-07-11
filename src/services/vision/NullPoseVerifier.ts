/**
 * Expo-Go-safe vision seam.
 * No VisionCamera / MediaPipe / native pose imports here — ever on the audio path.
 * Real backends land behind createPoseVerifier() in a later phase.
 */

import type {
  PoseVerifier,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

export type {
  PerceptionBackend,
  PoseVerifier,
  VerificationOutcome,
  VerificationResult,
  VerifyCueArgs,
  YawSample,
} from '@/types';

/** Always available — Expo Go / audio-only / tests */
export class NullPoseVerifier implements PoseVerifier {
  calibrateBaseline(_samples: YawSample[]): void {}

  verifyCue(_args: VerifyCueArgs): VerificationResult {
    return { outcome: 'unknown', backendId: 'null' };
  }
}

export function createPoseVerifier(): PoseVerifier {
  return new NullPoseVerifier();
}
