import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

interface DrillCountdownViewProps {
  /** 3 / 2 / 1 then 0 (rendered as "GO"); null shows nothing. */
  value: number | null;
}

/** The 3-2-1-GO pre-roll shown while the engine warms audio + verifier. */
export function DrillCountdownView({ value }: DrillCountdownViewProps) {
  const text = value === 0 ? 'GO' : value != null ? String(value) : '';
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>GET READY</Text>
      <Text style={styles.number}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  kicker: {
    ...typography.title,
    color: colors.textMuted,
    letterSpacing: 4,
    fontWeight: '800',
  },
  number: { fontSize: 160, fontWeight: '900', color: colors.primary },
});
