import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface, Icon, Icons } from '@/components/glass';
import type { DrillStatus } from '@/types';
import { accents, glass, glassRadius, glassType, glow, light, spacing } from '@/theme';

interface TransportControlsProps {
  status: DrillStatus;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /**
   * Quiet variant for the immersive Turn & React layout: same glass material,
   * slightly tighter padding so it floats over the cue flood. Default false.
   */
  compact?: boolean;
}

/** Liquid-glass transport bar — Pause/Resume + Stop, same chrome as framing. */
export function TransportControls({ status, onPause, onResume, onStop, compact = false }: TransportControlsProps) {
  const paused = status === 'paused';
  const height = compact ? 48 : 56;

  return (
    <View style={styles.row}>
      <View style={[styles.shadow, { flex: 1.35 }]}>
        <Pressable
          onPress={paused ? onResume : onPause}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Resume drill' : 'Pause drill'}
          style={styles.press}
        >
          <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={[styles.pill, { height }]}>
            <Icon icon={paused ? Icons.Play : Icons.Pause} size={18} color={light.ink} strokeWidth={2} />
            <Text style={styles.label}>{paused ? 'Resume' : 'Pause'}</Text>
          </GlassSurface>
        </Pressable>
      </View>

      <View style={[styles.shadow, { flex: 1 }]}>
        <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop drill" style={styles.press}>
          <GlassSurface
            radius={glassRadius.pill}
            intensity="regular"
            fill={glass.fill}
            tintColor={accents.data.wash}
            style={[styles.pill, { height }]}
          >
            <Icon icon={Icons.X} size={18} color={accents.data.solid} strokeWidth={2.25} />
            <Text style={[styles.label, { color: accents.data.solid }]}>Stop</Text>
          </GlassSurface>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shadow: { borderRadius: glassRadius.pill, ...glow.floating },
  press: { width: '100%' },
  pill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  label: { ...glassType.label, fontSize: 15, color: light.ink, fontWeight: '600' },
});
