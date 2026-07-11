import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CueDefinition } from '@/types';
import { colors, glass, glassRadius, glassType, light, spacing } from '@/theme';

interface GlassCueChipProps {
  cue: CueDefinition;
  selected: boolean;
  onToggle: (id: CueDefinition['id']) => void;
  disabled?: boolean;
}

/**
 * Toggleable cue pill. Reuses the drill's own cue color-coding as the accent
 * that pops against the light glass — the meaning is legible before the word.
 * Kept as a translucent fill (not a blur layer) so a wrap of eight stays light.
 */
export function GlassCueChip({ cue, selected, onToggle, disabled = false }: GlassCueChipProps) {
  const accent = colors[cue.colorToken];
  return (
    <Pressable
      onPress={() => onToggle(cue.id)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? `${accent}26` : glass.fillSubtle,
          borderColor: selected ? accent : glass.borderInk,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: accent, opacity: selected ? 1 : 0.4 }]} />
      <Text style={[styles.label, { color: selected ? light.ink : light.inkMuted }]}>{cue.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: glassRadius.pill,
    borderWidth: 1.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...glassType.label, fontWeight: '700' },
});
