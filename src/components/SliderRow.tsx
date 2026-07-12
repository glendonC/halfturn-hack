import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel: string;
  accent?: string;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
}

/** Labeled slider with a live value readout. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  valueLabel,
  accent = colors.primary,
  onValueChange,
  onSlidingComplete,
}: SliderRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: accent }]}>{valueLabel}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...typography.label, color: colors.textSecondary },
  value: { ...typography.subtitle, fontWeight: '800' },
  slider: { width: '100%', height: 36 },
});
