import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLOR_WORDS, NUMBER_RANGE } from '@/constants/cues';
import type { CueDefinition } from '@/types';
import { colors, glass, glassRadius, glassType, light, spacing } from '@/theme';

interface GlassCueChipProps {
  cue: CueDefinition;
  selected: boolean;
  onToggle: (id: CueDefinition['id']) => void;
  disabled?: boolean;
}

/** Compact inline hint — only for cues whose plain label is opaque. */
function detailFor(cue: CueDefinition): string | null {
  switch (cue.id) {
    case 'number':
      return `${NUMBER_RANGE.min}–${NUMBER_RANGE.max}`;
    case 'color':
      return COLOR_WORDS.slice(0, 3).join('/');
    default:
      return null;
  }
}

/**
 * Toggleable cue pill. Same language as before: color dot + label. Variable cues
 * (Number / Color) tuck a tiny sample after the name so they aren't mystery labels.
 */
export function GlassCueChip({ cue, selected, onToggle, disabled = false }: GlassCueChipProps) {
  const accent = colors[cue.colorToken];
  const detail = detailFor(cue);

  return (
    <Pressable
      onPress={() => onToggle(cue.id)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={detail ? `${cue.label}, ${detail}` : cue.label}
      accessibilityHint={cue.description}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? `${accent}26` : glass.fillSubtle,
          borderColor: selected ? accent : 'rgba(24,20,37,0.12)',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: accent, opacity: selected ? 1 : 0.4 }]} />
      <Text style={[styles.label, { color: selected ? light.ink : light.inkMuted }]}>{cue.label}</Text>
      {detail ? <Text style={[styles.detail, { color: selected ? accent : light.inkFaint }]}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: glassRadius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...glassType.label, fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  detail: { ...glassType.caption, fontSize: 11, fontWeight: '600' },
});
