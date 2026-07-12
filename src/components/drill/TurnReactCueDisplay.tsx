import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CUES } from '@/constants/cues';
import {
  REVEAL_WINDOW_MS,
  TURN_REACT_CUE_FLOODS,
  getTurnReactColor,
} from '@/constants/turnReact';
import { glassType, light } from '@/theme';
import type { CueEvent } from '@/types';
import { CUE_FLASH_ENABLED, CueFlashProbe } from './CueFlashProbe';

interface TurnReactCueDisplayProps {
  currentCue: CueEvent | null;
}

/**
 * Turn-and-react cue surface. Unlike the audio-drill `CueDisplay` (which
 * FADES a flood as a peripheral-glance aid), here the flood is INFORMATION: the
 * player half-turns to read it, so it PERSISTS for `REVEAL_WINDOW_MS` then snaps
 * to neutral until the next cue. The on-screen value is the cue — the spoken
 * value is suppressed in this mode (a beep is the reaction anchor).
 *
 * Presentation is split by state: the NEUTRAL state lives in the light glass
 * world (bloom base, ultralight READY) so it is continuous with the rest of the
 * app AND maximally distinct from any flood at a peripheral glance; the REVEAL
 * keeps full-saturation floods + a giant heavy word, readable at 2–4 m in
 * sunlight, with the word as colorblind-redundant coding for the `color` cue
 * (no White/Black floods — see constants/turnReact).
 */
export function TurnReactCueDisplay({ currentCue }: TurnReactCueDisplayProps) {
  const seq = currentCue?.seq ?? -1;
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentCue) return;
    setRevealed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRevealed(false), REVEAL_WINDOW_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  if (!currentCue || !revealed) {
    return (
      <View style={[styles.container, styles.neutral]}>
        <Text style={styles.waiting}>READY</Text>
      </View>
    );
  }

  const def = CUES[currentCue.cueId];
  const isColor = currentCue.cueId === 'color';
  const isNumber = currentCue.cueId === 'number';

  // Resolve flood + auto-contrast text per cue kind.
  let flood: string = light.base;
  let textColor: string = light.ink;
  if (isColor) {
    const c = getTurnReactColor(currentCue.phrase);
    flood = c?.flood ?? TURN_REACT_CUE_FLOODS.cueVariableColor.flood;
    textColor = c?.text ?? '#FFFFFF';
  } else if (isNumber) {
    flood = light.white; // neutral plate; the number itself is the signal
    textColor = light.ink;
  } else {
    const pair = TURN_REACT_CUE_FLOODS[def.colorToken];
    flood = pair?.flood ?? light.base;
    textColor = pair?.text ?? light.ink;
  }

  const big = (isColor || isNumber ? currentCue.phrase : def.label).toUpperCase();
  const showLeft = currentCue.side === 'left';
  const showRight = currentCue.side === 'right';

  return (
    <View style={[styles.container, { backgroundColor: flood }]}>
      <View style={styles.center}>
        {showLeft ? (
          <Text style={[styles.chevron, { color: textColor }]}>‹</Text>
        ) : (
          <View style={styles.chevronSpacer} />
        )}
        <View style={styles.value}>
          {isColor ? <Text style={[styles.tag, { color: textColor }]}>COLOR</Text> : null}
          <Text
            style={[styles.word, { color: textColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {big}
          </Text>
        </View>
        {showRight ? (
          <Text style={[styles.chevron, { color: textColor }]}>›</Text>
        ) : (
          <View style={styles.chevronSpacer} />
        )}
      </View>
      {/* Dev-only reaction-time ground-truth marker, co-timed with this reveal. */}
      {CUE_FLASH_ENABLED ? <CueFlashProbe seq={currentCue.seq} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  neutral: { backgroundColor: light.base },
  waiting: {
    ...glassType.hero,
    fontSize: 64,
    lineHeight: 72,
    color: light.inkFaint,
    letterSpacing: 4,
  },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  value: { alignItems: 'center', flexShrink: 1 },
  tag: { ...glassType.overline, fontSize: 15, letterSpacing: 6, marginBottom: 8, opacity: 0.8 },
  word: { fontSize: 120, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  chevron: { fontSize: 120, fontWeight: '800', marginHorizontal: 8 },
  chevronSpacer: { width: 36 },
});
