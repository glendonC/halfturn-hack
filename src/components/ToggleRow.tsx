import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** Label + optional description + a Switch. */
export function ToggleRow({ label, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.textPrimary}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  description: { ...typography.caption, color: colors.textMuted },
});
