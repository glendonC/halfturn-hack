import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type ScreenPlaceholderProps = {
  title: string;
  purpose: string;
};

export function ScreenPlaceholder({ title, purpose }: ScreenPlaceholderProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.purpose}>{purpose}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  purpose: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 340,
  },
});
