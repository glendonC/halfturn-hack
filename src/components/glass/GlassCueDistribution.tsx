import { StyleSheet, Text, View } from 'react-native';

import { CUE_ORDER, getCueDefinition } from '@/constants';
import type { CueType } from '@/types';
import { glassRadius, glassType, light } from '@/theme';

/** Sparse cue-id → count map for summary charts. */
export type CueCounts = Partial<Record<CueType, number>>;

interface GlassCueDistributionProps {
  counts: CueCounts;
  total: number;
}

const BAR_COLORS: Record<string, string> = {
  check_left: '#22D3EE',
  check_right: '#FB923C',
  scan: '#A3E635',
  turn: '#A3E635',
  man_on: '#FB7185',
  color: '#C084FC',
  number: '#FACC15',
};

/** Light-glass cue distribution: cue-colored bars, ink labels/counts. */
export function GlassCueDistribution({ counts, total }: GlassCueDistributionProps) {
  const rows = CUE_ORDER.filter((id) => (counts[id] ?? 0) > 0);
  if (rows.length === 0) {
    return <Text style={styles.empty}>No cues fired.</Text>;
  }
  const max = Math.max(...rows.map((id) => counts[id] ?? 0), 1);

  return (
    <View style={styles.list}>
      {rows.map((id) => {
        const cue = getCueDefinition(id);
        const count = counts[id] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const accent = BAR_COLORS[id] ?? light.inkSoft;
        return (
          <View key={id} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {cue.label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: accent, width: `${(count / max) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.count}>
              {count}
              <Text style={styles.pct}>{`  ${pct}%`}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...glassType.label, color: light.inkMuted, width: 92 },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: glassRadius.pill,
    backgroundColor: 'rgba(24,20,37,0.07)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: glassRadius.pill },
  count: { ...glassType.label, color: light.ink, width: 70, textAlign: 'right' },
  pct: { ...glassType.caption },
  empty: { ...glassType.body },
});
