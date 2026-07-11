import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { accents, glassType, spacing, type AccentKey } from '@/theme';

interface GlassSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel?: string;
  accent?: AccentKey;
  onValueChange?: (v: number) => void;
  onSlidingComplete?: (v: number) => void;
}

/** Labeled slider styled for light glass: accent track + thumb, muted rail. */
export function GlassSlider({
  label,
  value,
  min,
  max,
  step = 1,
  valueLabel,
  accent = 'home',
  onValueChange,
  onSlidingComplete,
}: GlassSliderProps) {
  const solid = accents[accent].solid;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {valueLabel ? <Text style={styles.value}>{valueLabel}</Text> : null}
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        minimumTrackTintColor={solid}
        maximumTrackTintColor="rgba(24,20,37,0.14)"
        thumbTintColor={solid}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { ...glassType.label },
  value: { ...glassType.label, fontVariant: ['tabular-nums'] },
});
