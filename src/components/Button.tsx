import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'xl';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BG: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surfaceAlt,
  ghost: 'transparent',
  danger: colors.danger,
};

const FG: Record<Variant, string> = {
  primary: colors.onAccent,
  secondary: colors.textPrimary,
  ghost: colors.textSecondary,
  danger: colors.textPrimary,
};

const SIZE: Record<Size, { padV: number; font: number }> = {
  md: { padV: spacing.md, font: typography.subtitle.fontSize as number },
  lg: { padV: spacing.lg, font: typography.title.fontSize as number },
  xl: { padV: spacing.xl, font: typography.heading.fontSize as number },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const sz = SIZE[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: BG[variant],
          paddingVertical: sz.padV,
          borderColor: variant === 'ghost' ? colors.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <Text style={[styles.label, { color: FG[variant], fontSize: sz.font }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: { fontWeight: '800', letterSpacing: 0.3 },
});
