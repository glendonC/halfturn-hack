import { StyleSheet, Text, View } from 'react-native';

import { CUE_ORDER, CUES } from '@/constants/cues';
import type { CueCounts } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

interface CueDistributionProps {
  counts: CueCounts;
  total: number;
}

/** Horizontal bar list showing how cues were distributed across a session. */
export function CueDistribution({ counts, total }: CueDistributionProps) {
  const rows = CUE_ORDER.filter((id) => (counts[id] ?? 0) > 0);
  if (rows.length === 0) {
    return <Text style={styles.empty}>No cues fired.</Text>;
  }
  const max = Math.max(...rows.map((id) => counts[id] ?? 0), 1);

  return (
    <View style={styles.list}>
      {rows.map((id) => {
        const cue = CUES[id];
        const count = counts[id] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const accent = colors[cue.colorToken];
        return (
          <View key={id} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {cue.label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { backgroundColor: accent, width: `${(count / max) * 100}%` }]}
              />
            </View>
            <Text style={styles.count}>
              {count}
              <Text style={styles.pct}>  {pct}%</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary, width: 92 },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
  count: { ...typography.label, color: colors.textPrimary, width: 70, textAlign: 'right' },
  pct: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted },
});
