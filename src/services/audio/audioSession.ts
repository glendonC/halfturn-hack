import { setAudioModeAsync } from 'expo-audio';

/**
 * Configure the shared app audio session for drill cues in headphones.
 *
 * iOS ringer-switch gotcha: without playsInSilentMode, Speech/audio is silenced
 * when the hardware switch is on Mute — common on the field. See docs/AUDIO.md.
 */
export async function configureDrillAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    // Duck music / podcasts in headphones rather than hard-stopping them.
    interruptionMode: 'duckOthers',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}
