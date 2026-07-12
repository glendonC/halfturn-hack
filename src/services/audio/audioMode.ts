import { setAudioModeAsync, type InterruptionMode } from 'expo-audio';

import type { AudioOutputMode } from '@/types';

/**
 * Configure the global audio session so cues are audible and play nicely with
 * the player's music.
 *
 * Notes from the architecture review:
 * - `playsInSilentMode: true` is required whenever `interruptionMode` is
 *   `duckOthers` on iOS, and is also our best shot at audibility when the iOS
 *   ringer switch is on silent (see the documented constraint in README).
 * - `shouldPlayInBackground: false` — today's default keeps the screen awake and runs in
 *   the foreground; we do not claim the background-audio capability.
 * - We never pass `interruptionModeAndroid` (deprecated; silently no-ops ducking).
 */
export async function configureAudioSession(mode: AudioOutputMode): Promise<void> {
  const interruptionMode: InterruptionMode = mode === 'headphones' ? 'duckOthers' : 'mixWithOthers';
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode,
      shouldPlayInBackground: false,
    });
  } catch (err) {
    // Non-fatal: cues still attempt to play. The pre-drill audio check surfaces
    // any real audibility problem to the player.
    console.warn('[audio] failed to configure audio session', err);
  }
}
