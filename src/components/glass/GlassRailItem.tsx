import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accents, glass, light, type AccentKey } from '@/theme';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconComponent } from './Icon';
import { Check } from './icons';

interface GlassRailItemProps {
  icon: IconComponent;
  selected: boolean;
  onPress: () => void;
  accent?: AccentKey;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One button in the right-hand customization strip: a frosted-glass lozenge with
 * the section's icon and a selection state — a filled accent check when active, a
 * quiet ring when not. Icons (not letters) so each pill reads as its real section.
 */
export function GlassRailItem({ icon, selected, onPress, accent = 'home', accessibilityLabel, style }: GlassRailItemProps) {
  const solid = accents[accent].solid;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, style]}
    >
      <GlassSurface
        radius={22}
        intensity={selected ? 'thick' : 'regular'}
        fill={selected ? glass.fillStrong : glass.fill}
        tintColor={selected ? accents[accent].wash : undefined}
        style={styles.item}
      >
        <Icon icon={icon} size={19} color={selected ? solid : light.inkMuted} strokeWidth={selected ? 2 : 1.75} />
        {selected ? (
          <View style={[styles.check, { backgroundColor: solid }]}>
            <Icon icon={Check} size={11} color={light.white} strokeWidth={3} />
          </View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 64,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(24,20,37,0.16)' },
});
