import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';

import { COUNTDOWN_FLOOD, HUD_NEUTRAL } from './cueColors';
import { DrillCountdownView } from './DrillCountdownView';

export function CountdownHud() {
  const insets = useSafeAreaInsets();
  const countdownRemainingSec = useDrillStore((s) => s.countdownRemainingSec);
  const mode = useDrillStore((s) => s.config.mode);
  const stop = useDrillStore((s) => s.stop);

  const hint =
    mode === 'turn_react'
      ? 'Face the phone · turn to read'
      : 'Eyes up · headphones on';

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
      <DrillCountdownView value={countdownRemainingSec} hint={hint} />
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
