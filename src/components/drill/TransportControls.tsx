import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DrillStatus } from '@/types';

import { HUD_NEUTRAL } from './cueColors';

interface TransportControlsProps {
  status: DrillStatus;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /**
   * Quiet variant for turn-react: translucent buttons over the cue flood.
   * Default false = prominent audio-HUD buttons.
   */
  compact?: boolean;
}

/** Shared pause / resume / stop chrome for audio and turn-react layouts. */
export function TransportControls({
  status,
  onPause,
  onResume,
  onStop,
  compact = false,
}: TransportControlsProps) {
  const paused = status === 'paused';

  return (
    <View style={styles.col}>
      <Pressable
        onPress={paused ? onResume : onPause}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Resume drill' : 'Pause drill'}
        style={({ pressed }) => [
          styles.btn,
          compact && styles.btnCompact,
          paused ? styles.btnEmphasis : null,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.btnText,
            paused && styles.btnTextEmphasis,
          ]}
        >
          {paused ? 'Resume' : 'Pause'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="Stop drill"
        style={({ pressed }) => [
          styles.btn,
          compact && styles.btnCompact,
          styles.btnDanger,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.btnText, styles.btnTextDanger]}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 12 },
  btn: {
    minHeight: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnCompact: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  btnEmphasis: {
    backgroundColor: HUD_NEUTRAL.accent,
    borderColor: HUD_NEUTRAL.accent,
  },
  btnDanger: {
    borderColor: HUD_NEUTRAL.danger,
  },
  btnText: {
    color: '#F2F7F4',
    fontSize: 22,
    fontWeight: '800',
  },
  btnTextEmphasis: {
    color: HUD_NEUTRAL.bg,
  },
  btnTextDanger: {
    color: HUD_NEUTRAL.danger,
  },
  pressed: { opacity: 0.88 },
});
