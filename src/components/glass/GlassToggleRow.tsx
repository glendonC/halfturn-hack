import { StyleSheet, Switch, Text, View } from 'react-native';

import { accents, glassType, light, spacing, type AccentKey } from '@/theme';

interface GlassToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  accent?: AccentKey;
}

/** Label + description + iOS switch, tuned for the light glass surface. */
export function GlassToggleRow({ label, description, value, onValueChange, accent = 'home' }: GlassToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: accents[accent].solid, false: 'rgba(24,20,37,0.14)' }}
        thumbColor={light.white}
        ios_backgroundColor="rgba(24,20,37,0.14)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  text: { flex: 1, gap: 3 },
  label: { ...glassType.subtitle, fontSize: 15 },
  description: { ...glassType.caption, lineHeight: 16 },
});
