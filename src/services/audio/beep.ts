import { createAudioPlayer } from 'expo-audio';

/**
 * Directionless reaction-anchor beep (turn-react). Spoken value is suppressed
 * in that mode; a short beep + haptic is the clean onset signal.
 *
 * Expo-Go-safe: uses expo-audio (already a dependency for the audio session).
 * One shared player is reused; each cue seeks to 0 and replays.
 *
 * Audio-mode MVP leaves this unwired by default (TTS is the cue). Turn-react
 * shell (#8) primes/plays it.
 */

// Asset module (Metro returns an opaque asset id).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BEEP_SOURCE = require('../../../assets/sounds/beep.wav');

type BeepPlayer = ReturnType<typeof createAudioPlayer>;

let player: BeepPlayer | null = null;

/** Pre-create the player so the first beep isn't delayed by cold-start. */
export function primeBeep(): void {
  if (player) return;
  try {
    player = createAudioPlayer(BEEP_SOURCE);
  } catch {
    player = null; // best-effort; turn-react still works with haptics only
  }
}

/** Fire the beep from the start (fire-and-forget; safe to call on every cue). */
export function playBeep(): void {
  primeBeep();
  const p = player;
  if (!p) return;
  void (async () => {
    try {
      await p.seekTo(0);
      p.play();
    } catch {
      // best-effort
    }
  })();
}

/** Release the shared player (call when the drill tears down). */
export function releaseBeep(): void {
  try {
    player?.remove();
  } catch {
    // ignore
  }
  player = null;
}
