import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

/** Rounded surface container used to group related controls. */
export function Card({ children, title, subtitle, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.subtitle, color: colors.textPrimary },
  subtitle: { ...typography.label, color: colors.textMuted, marginTop: -spacing.sm },
});
