import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accents, glass, glassRadius, hitSlop, light, type AccentKey } from '@/theme';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconComponent } from './Icon';

interface GlassIconButtonProps {
  icon: IconComponent;
  onPress?: () => void;
  size?: number;
  /** Emphasized/selected state: opaque fill + accent glyph. */
  active?: boolean;
  /** Accent for the active glyph color. */
  accent?: AccentKey;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** A circular frosted-glass icon button — the notification/settings/nav chrome. */
export function GlassIconButton({
  icon,
  onPress,
  size = 46,
  active = false,
  accent = 'home',
  accessibilityLabel,
  style,
}: GlassIconButtonProps) {
  const glyphColor = active ? accents[accent].solid : light.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }, style]}
    >
      <GlassSurface
        radius={glassRadius.pill}
        intensity={active ? 'thick' : 'regular'}
        fill={active ? glass.fillStrong : glass.fill}
        style={[styles.circle, { width: size, height: size }]}
      >
        <View style={styles.center}>
          <Icon icon={icon} size={size * 0.44} color={glyphColor} strokeWidth={active ? 2 : 1.75} />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
