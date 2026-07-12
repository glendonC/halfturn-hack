import { createAudioPlayer } from 'expo-audio';

/**
 * The directionless reaction-anchor beep for turn-and-react mode. In that mode
 * the spoken cue value is suppressed (the player must physically turn to read it
 * off the screen), so a short beep + haptic is the clean reaction anchor.
 *
 * Expo-Go-safe: expo-audio is already a dependency (audio session config). One
 * shared player is reused; each cue seeks to 0 and replays.
 */

// Asset module (Metro returns an opaque asset id); RN's global require types it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BEEP_SOURCE = require('../../../assets/sounds/beep.wav');

type BeepPlayer = ReturnType<typeof createAudioPlayer>;

let player: BeepPlayer | null = null;
let confirmPlayer: BeepPlayer | null = null;

/** Pre-create the player so the first beep isn't delayed by cold-start. */
export function primeBeep(): void {
  if (player) return;
  try {
    player = createAudioPlayer(BEEP_SOURCE);
  } catch {
    player = null; // best-effort; turn-react still works with haptics only
  }
}

/**
 * Pre-create the verified-turn confirm sound: the same beep sample sped up so
 * it reads as a higher, shorter "ding" — audibly distinct from the cue beep
 * without shipping a second asset.
 */
export function primeConfirm(): void {
  if (confirmPlayer) return;
  try {
    confirmPlayer = createAudioPlayer(BEEP_SOURCE);
    confirmPlayer.setPlaybackRate(1.6);
  } catch {
    confirmPlayer = null; // best-effort; haptic confirm still fires
  }
}

/** Fire the verified-turn confirm (fire-and-forget). */
export function playConfirm(): void {
  primeConfirm();
  const p = confirmPlayer;
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

/** Release the shared players (call when the drill tears down). */
export function releaseBeep(): void {
  try {
    player?.remove();
  } catch {
    // ignore
  }
  player = null;
  try {
    confirmPlayer?.remove();
  } catch {
    // ignore
  }
  confirmPlayer = null;
}
