import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * DEV-ONLY reaction-time ground-truth marker (validation instrumentation, see
 * docs/scan-tracking-architecture.md §7). A second phone at 120–240fps frames the
 * athlete AND the app's screen; this marker gives that reference camera a crisp,
 * frame-accurate ONSET it can timestamp on the same clock as the athlete's
 * movement, yielding true reaction time with no native capture timestamp — and
 * exposing the `firedAtMonoMs → physical-photons` render/pipeline bias (`L_pipe`).
 *
 * Two correctness properties this component is built around (both were refuted in
 * an earlier naive design):
 *  1. CO-TIMED WITH THE CUE THE ATHLETE READS, not with `recordCue`. The cue flood
 *     is gated on `TurnReactCueDisplay`'s `revealed` state, which flips true in a
 *     passive effect ONE commit after the store's `recordCue`. So this marker is
 *     mounted INSIDE the cue-reveal branch and flashes on mount (== the reveal
 *     commit) using the derive-state-during-render pattern — an effect would defer
 *     it a frame and make the marker systematically LEAD the readable cue.
 *  2. NON-OCCLUDING. It is a small corner patch, never a full-screen flash, so it
 *     cannot hide the cue from a fast athlete who faces the screen inside the flash
 *     window; and it is `pointerEvents="none"` so it never swallows a Stop/Pause tap
 *     (TurnReactLayout relies on `box-none` hit-testing).
 *
 * Gated by `CUE_FLASH_ENABLED` (`__DEV__` + `EXPO_PUBLIC_CUE_FLASH=1`): dead code in
 * production (`__DEV__` is false there). In Expo Go `__DEV__` is true, so it is gated
 * OFF by default and only renders if a dev sets the flag — and it imports only
 * react-native, so it stays Expo-Go-safe either way.
 */

/** Dev + explicit opt-in. Never set in production or Expo Go. */
export const CUE_FLASH_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_CUE_FLASH === '1';

/**
 * Marker on-screen duration. ~1.5 app frames @60Hz — long enough to be several
 * frames on a 120–240fps reference camera, short enough to clear well before the
 * fastest plausible turn onset (>150ms) so it never competes with the cue read.
 */
const FLASH_MS = 90;

interface CueFlashProbeProps {
  /** The revealed cue's seq — flashes once per distinct seq. */
  seq: number;
}

export function CueFlashProbe({ seq }: CueFlashProbeProps) {
  const [flashingSeq, setFlashingSeq] = useState(-1);
  const startedRef = useRef(-1);

  // Adjust state DURING render (React's "reset state on prop change" pattern) so the
  // marker is in the very same commit that paints the cue flood — an effect-driven
  // setState would paint it one frame later and bias the ground-truth anchor.
  if (seq >= 0 && startedRef.current !== seq) {
    startedRef.current = seq;
    setFlashingSeq(seq);
  }

  useEffect(() => {
    if (flashingSeq < 0) return;
    const t = setTimeout(() => setFlashingSeq(-1), FLASH_MS);
    return () => clearTimeout(t);
  }, [flashingSeq]);

  if (flashingSeq !== seq) return null;
  return <View style={styles.marker} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  // Bottom-left corner: clear of the centered cue word/chevrons, the top-left status
  // pill, the top-right diagnostics, and the bottom-right self-view squircle. White
  // fill + black ring stays high-contrast against every cue flood (incl. light ones)
  // so the reference camera can code a clean neutral→marker onset.
  marker: {
    position: 'absolute',
    left: 0,
    bottom: 140,
    width: 104,
    height: 104,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#000000',
  },
});
