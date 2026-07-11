import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';
import type { UseDrillEngineResult } from '@/services/drill';

import { HUD_NEUTRAL } from './cueColors';
import { DrillCountdownView } from './DrillCountdownView';

/**
 * Optional cancel chrome around the countdown digits.
 * Active prefers DrillCountdownView directly; kept for leftover call sites.
 */
export function CountdownHud({
  engine,
}: {
  engine: UseDrillEngineResult;
}) {
  const insets = useSafeAreaInsets();
  const storeCountdown = useDrillStore((s) => s.countdownRemainingSec);
  const value = engine.countdownValue ?? storeCountdown;

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
      <DrillCountdownView value={value} />
      <Pressable
        onPress={engine.stop}
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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
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
