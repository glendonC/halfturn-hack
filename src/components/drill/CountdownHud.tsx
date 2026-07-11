import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';

import { COUNTDOWN_FLOOD, HUD_NEUTRAL } from './cueColors';

export function CountdownHud() {
  const insets = useSafeAreaInsets();
  const countdownRemainingSec = useDrillStore((s) => s.countdownRemainingSec);
  const mode = useDrillStore((s) => s.config.mode);
  const stop = useDrillStore((s) => s.stop);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text style={styles.eyebrow}>Get set</Text>
      <View style={styles.center}>
        <Text style={styles.number}>{countdownRemainingSec}</Text>
        <Text style={styles.hint}>
          {mode === 'turn_react'
            ? 'Face the phone · turn to read'
            : 'Eyes up · headphones on'}
        </Text>
      </View>
      <Pressable
        onPress={stop}
        style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
      >
        <Text style={styles.stopText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COUNTDOWN_FLOOD.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: HUD_NEUTRAL.muted,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  number: {
    fontSize: 160,
    fontWeight: '900',
    color: COUNTDOWN_FLOOD.text,
    lineHeight: 170,
  },
  hint: {
    color: HUD_NEUTRAL.muted,
    fontSize: 18,
    fontWeight: '600',
  },
  stop: {
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stopText: {
    color: HUD_NEUTRAL.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: { opacity: 0.85 },
});
