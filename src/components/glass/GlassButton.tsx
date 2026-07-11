import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { accents, glass, glassRadius, light, spacing, type AccentKey } from '@/theme';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconComponent } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'lg';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Fills a `primary` button with a section accent instead of ink. */
  accent?: AccentKey;
  icon?: IconComponent;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<Size, { padV: number; font: number; icon: number }> = {
  md: { padV: 14, font: 16, icon: 18 },
  lg: { padV: 18, font: 19, icon: 20 },
};

/**
 * The action primitive. `primary` is a confident solid ink pill (echoing the dark Home circle); `secondary` is frosted glass; `danger` is the
 * warm coral accent. Pass `accent` to tint a primary button to a section color.
 */
export function GlassButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  accent,
  icon,
  disabled = false,
  loading = false,
  style,
}: GlassButtonProps) {
  const sz = SIZES[size];
  const isGlass = variant === 'secondary';
  const fg = isGlass ? light.ink : light.white;
  const solidBg = variant === 'danger' ? accents.data.solid : accent ? accents[accent].solid : light.ink;

  const content = (
    <View style={styles.row}>
      {icon ? <Icon icon={icon} size={sz.icon} color={fg} strokeWidth={2} /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg, fontSize: sz.font }]}>{label}</Text>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      {isGlass ? (
        <GlassSurface
          radius={glassRadius.card}
          intensity="regular"
          fill={glass.fillStrong}
          style={[styles.base, { paddingVertical: sz.padV }]}
        >
          {content}
        </GlassSurface>
      ) : (
        <View style={[styles.base, { paddingVertical: sz.padV, borderRadius: glassRadius.card, backgroundColor: solidBg }]}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontWeight: '600', letterSpacing: 0.2 },
});
