import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

interface StatProps {
  value: string;
  label: string;
  accent?: string;
}

/** Compact metric tile: big value over a small label. */
export function Stat({ value, label, accent = colors.textPrimary }: StatProps) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  value: { ...typography.title, fontWeight: '900' },
  label: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
