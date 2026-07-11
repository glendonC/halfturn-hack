/**
 * Runtime guards for the Expo Go vs custom-dev-client split.
 * Native vision must never load on the StoreClient (Expo Go) entry.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when running inside Expo Go (no custom native modules). */
export function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

/**
 * Env flag for custom/dev-client builds that intend to enable vision.
 * Never set this for the Expo Go audio path.
 */
export function isVisionEnvEnabled(): boolean {
  return process.env.EXPO_PUBLIC_VISION === '1';
}

/**
 * Native vision is allowed only on a custom client with the env flag.
 * Expo Go always returns false → NullBackend / NullPoseVerifier.
 */
export function canUseNativeVision(): boolean {
  return isVisionEnvEnabled() && !isExpoGo();
}
