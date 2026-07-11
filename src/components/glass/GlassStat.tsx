import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { accents, glassType, light, type AccentKey } from '@/theme';

type StatSize = 'sm' | 'md' | 'lg';

interface GlassStatProps {
  value: string;
  label: string;
  /** Colors the numeral; defaults to ink. */
  accent?: AccentKey;
  /** Or pass an explicit color (e.g. a cue color). */
  color?: string;
  size?: StatSize;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

const NUMERAL_SIZE: Record<StatSize, number> = { sm: 26, md: 34, lg: 50 };

/**
 * Signature readout: a large light-weight numeral over a small
 * wide-tracked uppercase label. The one place big numbers earn their size.
 */
export function GlassStat({ value, label, accent, color, size = 'md', align = 'left', style }: GlassStatProps) {
  const numeralColor = color ?? (accent ? accents[accent].solid : light.ink);
  return (
    <View style={[align === 'center' ? styles.center : styles.left, style]}>
      <Text
        style={[glassType.numeral, { fontSize: NUMERAL_SIZE[size], color: numeralColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  left: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  label: { ...glassType.overline, marginTop: 3 },
});
