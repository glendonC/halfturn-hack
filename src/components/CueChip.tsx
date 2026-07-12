import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CueDefinition } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

interface CueChipProps {
  cue: CueDefinition;
  selected: boolean;
  onToggle: (id: CueDefinition['id']) => void;
  disabled?: boolean;
}

/** Toggleable pill for selecting cue types. Color dot mirrors the cue's HUD color. */
export function CueChip({ cue, selected, onToggle, disabled = false }: CueChipProps) {
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
          backgroundColor: selected ? `${accent}22` : colors.surfaceAlt,
          borderColor: selected ? accent : colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: accent, opacity: selected ? 1 : 0.4 }]} />
      <Text style={[styles.label, { color: selected ? colors.textPrimary : colors.textSecondary }]}>
        {cue.label}
      </Text>
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
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...typography.label, fontWeight: '700' },
});
