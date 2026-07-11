import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { REVEAL_WINDOW_MS } from '@/constants/turnReact';
import type { CueDefinition } from '@/types';

import { CUE_CATEGORY_FLOOD, HUD_NEUTRAL } from './cueColors';

/**
 * Eyes-on cue surface for turn-react preview.
 * Phrase stays up for REVEAL_WINDOW_MS then snaps to READY.
 * No camera / pose — NullPoseVerifier only.
 */
export function TurnReactCueSurface({
  cue,
  phrase,
  cueIndex,
}: {
  cue: CueDefinition | null;
  phrase: string | null;
  /** Bumps on each fire so the reveal window restarts. */
  cueIndex: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cue || cueIndex < 0) return;
    setRevealed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRevealed(false), REVEAL_WINDOW_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cue, cueIndex]);

  if (!cue || !revealed) {
    return (
      <View style={[styles.surface, styles.neutral]}>
        <Text style={styles.ready}>READY</Text>
        <Text style={styles.sub}>Turn to read the next cue</Text>
      </View>
    );
  }

  const flood = CUE_CATEGORY_FLOOD[cue.category];
  const label = (phrase ?? cue.hudLabel).toUpperCase();

  return (
    <View style={[styles.surface, { backgroundColor: flood.bg }]}>
      <Text
        style={[styles.phrase, { color: flood.text }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  neutral: {
    backgroundColor: HUD_NEUTRAL.bg,
  },
  ready: {
    color: HUD_NEUTRAL.accent,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sub: {
    color: HUD_NEUTRAL.muted,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  phrase: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
});
