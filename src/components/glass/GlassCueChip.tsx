import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CueDefinition, CueType } from '@/types';
import { glass, glassRadius, glassType, light, spacing } from '@/theme';

interface GlassCueChipProps {
  cue: CueDefinition;
  selected: boolean;
  onToggle: (id: CueDefinition['id']) => void;
  disabled?: boolean;
}

const CHIP_COLORS: Record<CueType, string> = {
  check_left: '#22D3EE',
  check_right: '#FB923C',
  scan: '#A3E635',
  turn: '#A3E635',
  man_on: '#FB7185',
  open_body: '#C8F542',
  color: '#C084FC',
  number: '#FACC15',
};

/**
 * Toggleable cue pill. Cue color accents pop against the light glass so the
 * meaning is legible before the word. Translucent fill (not blur) keeps a wrap
 * of eight chips light.
 */
export function GlassCueChip({
  cue,
  selected,
  onToggle,
  disabled = false,
}: GlassCueChipProps) {
  const accent = CHIP_COLORS[cue.id] ?? light.inkSoft;
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
      <View
        style={[
          styles.dot,
          { backgroundColor: accent, opacity: selected ? 1 : 0.4 },
        ]}
      />
      <Text
        style={[
          styles.label,
          { color: selected ? light.ink : light.inkMuted },
        ]}
      >
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
    borderRadius: glassRadius.pill,
    borderWidth: 1.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...glassType.label, fontWeight: '700' },
});
