import { StyleSheet, Text, View } from 'react-native';

import { accents, glass, glassRadius, glassType, light, spacing } from '@/theme';
import { formatClock } from '@/utils/format';

interface DrillTimerProps {
  remainingMs: number;
  elapsedMs: number;
  durationMs: number;
  cueCount: number;
}

/** Big remaining-time readout + a thin progress bar + cue counter. */
export function DrillTimer({ remainingMs, elapsedMs, durationMs, cueCount }: DrillTimerProps) {
  const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.meta}>{cueCount} cues</Text>
        <Text style={styles.meta}>{formatClock(elapsedMs / 1000)} elapsed</Text>
      </View>
      <Text style={styles.time}>{formatClock(remainingMs / 1000)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { ...glassType.label, color: light.inkMuted },
  time: {
    ...glassType.hero,
    fontSize: 64,
    lineHeight: 70,
    color: light.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: glassRadius.pill,
    backgroundColor: glass.fillSubtle,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: accents.audio.solid, borderRadius: glassRadius.pill },
});
