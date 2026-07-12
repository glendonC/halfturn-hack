import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

interface SectionHeaderProps {
  title: string;
  hint?: string;
}

export function SectionHeader({ title, hint }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs },
  title: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
});
