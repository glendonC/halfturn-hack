import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { accents, glass, glassRadius, glassType, light, type AccentKey } from '@/theme';
import { GlassSurface } from './GlassSurface';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface GlassSegmentOption<T> {
  label: string;
  value: T;
}

interface GlassSegmentedProps<T> {
  options: GlassSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: AccentKey;
}

/** A frosted segmented control; the selected segment lifts to an opaque pill. */
export function GlassSegmented<T extends string | number>({
  options,
  value,
  onChange,
  accent = 'home',
}: GlassSegmentedProps<T>) {
  const select = (v: T) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(160, 'easeInEaseOut', 'opacity'));
    onChange(v);
  };
  return (
    <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fillSubtle} style={styles.track}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => select(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            {active ? <View style={styles.activePill} /> : null}
            <Text
              style={[
                styles.label,
                { color: active ? accents[accent].solid : light.inkMuted, fontWeight: active ? '700' : '600' },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    margin: 0,
    borderRadius: glassRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#2A2340',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: { ...glassType.label, fontSize: 14 },
});
