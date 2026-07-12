import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { CUES } from '@/constants/cues';
import type { CueEvent } from '@/types';
import { colors, glassType, light } from '@/theme';

interface CueDisplayProps {
  currentCue: CueEvent | null;
  waiting?: boolean;
}

/**
 * The glanceable HUD. On each cue it full-bleed color-floods (fading out) and
 * pops the word, so a moving player reads the cue peripherally without focusing
 * on text. Directional cues add a large side chevron.
 */
export function CueDisplay({ currentCue, waiting = false }: CueDisplayProps) {
  const flash = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const seq = currentCue?.seq ?? -1;

  useEffect(() => {
    if (!currentCue) return;
    flash.setValue(1);
    scale.setValue(1.18);
    Animated.parallel([
      Animated.timing(flash, { toValue: 0, duration: 850, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  const def = currentCue ? CUES[currentCue.cueId] : null;
  const accent = def ? colors[def.colorToken] : colors.cueNeutral;
  const isVariable = def?.category === 'variable';
  const big = currentCue
    ? (isVariable ? currentCue.phrase : def!.label).toUpperCase()
    : waiting
      ? 'LISTEN'
      : 'GET READY';
  const tag = isVariable ? def!.label.toUpperCase() : null;
  const showLeft = currentCue?.side === 'left';
  const showRight = currentCue?.side === 'right';
  const idle = !currentCue;

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[styles.flood, { backgroundColor: accent, opacity: flash }]}
      />
      <View style={styles.center}>
        {showLeft ? <Text style={[styles.chevron, { color: accent }]}>‹</Text> : <View style={styles.chevronSpacer} />}
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center', flexShrink: 1 }}>
          {tag ? <Text style={[styles.tag, { color: accent }]}>{tag}</Text> : null}
          <Text
            style={[styles.word, { color: idle ? light.inkFaint : accent }]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {big}
          </Text>
        </Animated.View>
        {showRight ? <Text style={[styles.chevron, { color: accent }]}>›</Text> : <View style={styles.chevronSpacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  flood: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  chevron: { fontSize: 96, fontWeight: '200', marginHorizontal: 4 },
  chevronSpacer: { width: 28 },
  tag: { ...glassType.overline, letterSpacing: 4, marginBottom: 4, opacity: 0.9 },
  word: {
    ...glassType.hero,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '200',
    letterSpacing: -1,
    textAlign: 'center',
  },
});
