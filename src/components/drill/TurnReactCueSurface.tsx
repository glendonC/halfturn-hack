import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  REVEAL_WINDOW_MS,
  TURN_REACT_NUMBER_PLATE,
  getTurnReactColor,
} from '@/constants/turnReact';
import type { CueDefinition } from '@/types';

import { CUE_CATEGORY_FLOOD, HUD_NEUTRAL } from './cueColors';

/**
 * Eyes-on cue surface for turn-react preview.
 * Phrase stays up for REVEAL_WINDOW_MS then snaps to READY.
 * Color floods use the readable palette; numbers use a neutral plate;
 * directional checks get side chevrons. No camera / pose.
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

  const isColor = cue.id === 'color';
  const isNumber = cue.id === 'number';

  let flood = CUE_CATEGORY_FLOOD[cue.category].bg;
  let textColor = CUE_CATEGORY_FLOOD[cue.category].text;
  if (isColor) {
    const c = getTurnReactColor(phrase);
    flood = c?.flood ?? CUE_CATEGORY_FLOOD.variable.bg;
    textColor = c?.text ?? CUE_CATEGORY_FLOOD.variable.text;
  } else if (isNumber) {
    flood = TURN_REACT_NUMBER_PLATE.flood;
    textColor = TURN_REACT_NUMBER_PLATE.text;
  }

  const label = (phrase ?? cue.hudLabel).toUpperCase();
  const showLeft = cue.side === 'left';
  const showRight = cue.side === 'right';

  return (
    <View style={[styles.surface, { backgroundColor: flood }]}>
      <View style={styles.center}>
        {showLeft ? (
          <Text style={[styles.chevron, { color: textColor }]}>‹</Text>
        ) : (
          <View style={styles.chevronSpacer} />
        )}
        <View style={styles.value}>
          {isColor ? (
            <Text style={[styles.tag, { color: textColor }]}>COLOR</Text>
          ) : null}
          <Text
            style={[styles.phrase, { color: textColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        </View>
        {showRight ? (
          <Text style={[styles.chevron, { color: textColor }]}>›</Text>
        ) : (
          <View style={styles.chevronSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
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
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  value: {
    alignItems: 'center',
    flexShrink: 1,
  },
  tag: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 6,
    marginBottom: 8,
    opacity: 0.85,
  },
  phrase: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  chevron: {
    fontSize: 96,
    fontWeight: '900',
    marginHorizontal: 4,
  },
  chevronSpacer: {
    width: 28,
  },
});
