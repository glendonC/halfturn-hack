import { setAudioModeAsync, type InterruptionMode } from 'expo-audio';

import type { AudioOutputMode } from '@/types';

/**
 * Configure the global audio session so cues are audible and play nicely with
 * the player's music.
 *
 * Notes from the architecture review:
 * - `playsInSilentMode: true` is required whenever `interruptionMode` is
 *   `duckOthers` on iOS, and is also our best shot at audibility when the iOS
 *   ringer switch is on silent.
 * - `shouldPlayInBackground: false` — today's default keeps the screen awake and
 *   runs in the foreground; we do not claim the background-audio capability.
 */
export async function configureAudioSession(
  mode: AudioOutputMode = 'headphones',
): Promise<void> {
  const interruptionMode: InterruptionMode =
    mode === 'headphones' ? 'duckOthers' : 'mixWithOthers';
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode,
      shouldPlayInBackground: false,
    });
  } catch (err) {
    console.warn('[audio] failed to configure audio session', err);
  }
}
