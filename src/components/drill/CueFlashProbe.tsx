import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * DEV-ONLY reaction-time ground-truth marker. A second phone at 120–240fps
 * frames the athlete AND this screen; the marker gives that camera a crisp,
 * frame-accurate ONSET it can timestamp on the same clock as the athlete's
 * movement — yielding true reaction time without a native capture timestamp.
 *
 * Correctness properties:
 *  1. CO-TIMED WITH THE CUE THE ATHLETE READS, not with store.recordCue. The
 *     cue flood flips in a passive effect one commit after the store update, so
 *     this marker mounts inside the reveal branch and flashes on that same
 *     commit (derive-state-during-render). An effect would lag a frame.
 *  2. NON-OCCLUDING. Small corner patch, pointerEvents="none", never hides the
 *     cue or swallows Stop/Pause taps.
 *
 * Gated by `CUE_FLASH_ENABLED` (`__DEV__` + `EXPO_PUBLIC_CUE_FLASH=1`). Imports
 * only react-native, so it stays Expo-Go-safe either way.
 */

/** Dev + explicit opt-in. Off by default even in __DEV__. */
export const CUE_FLASH_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_CUE_FLASH === '1';

/** ~1.5 app frames @60Hz — several frames on a high-speed camera, clears before turn onset. */
const FLASH_MS = 90;

interface CueFlashProbeProps {
  /** The revealed cue's seq — flashes once per distinct seq. */
  seq: number;
}

export function CueFlashProbe({ seq }: CueFlashProbeProps) {
  const [flashingSeq, setFlashingSeq] = useState(-1);
  const startedRef = useRef(-1);

  // Reset state during render so the marker paints in the same commit as the cue flood.
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
  // Bottom-left: clear of cue word, status pill, diagnostics, and self-view squircle.
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
