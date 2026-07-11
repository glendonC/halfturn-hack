import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRemainingClock, useDrillStore } from '@/state';

import { HUD_NEUTRAL } from './cueColors';
import { TurnReactCueSurface } from './TurnReactCueSurface';

/**
 * Turn-react active shell: visual cue surface + beep onset (no camera).
 */
export function ActiveTurnReactHud() {
  const insets = useSafeAreaInsets();
  const status = useDrillStore((s) => s.status);
  const currentCue = useDrillStore((s) => s.currentCue);
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const timeRemainingMs = useDrillStore((s) => s.timeRemainingMs);
  const pause = useDrillStore((s) => s.pause);
  const resume = useDrillStore((s) => s.resume);
  const stop = useDrillStore((s) => s.stop);

  const paused = status === 'paused';

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
      <Text style={styles.meta}>
        {paused ? 'Paused' : 'Turn & React'} · {cuesFired} cues
      </Text>

      <TurnReactCueSurface
        cue={paused ? null : currentCue}
        phrase={paused ? null : currentPhrase}
        cueIndex={cuesFired - 1}
      />

      <Text style={styles.timer}>{formatRemainingClock(timeRemainingMs)}</Text>

      <View style={styles.actions}>
        {paused ? (
          <HudButton label="Resume" onPress={resume} emphasis />
        ) : (
          <HudButton label="Pause" onPress={pause} />
        )}
        <HudButton label="Stop" onPress={stop} danger />
      </View>
    </View>
  );
}

function HudButton({
  label,
  onPress,
  emphasis,
  danger,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        emphasis && styles.btnEmphasis,
        danger && styles.btnDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          emphasis && styles.btnTextEmphasis,
          danger && styles.btnTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HUD_NEUTRAL.bg,
    paddingHorizontal: 24,
    gap: 16,
  },
  meta: {
    color: HUD_NEUTRAL.muted,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timer: {
    color: HUD_NEUTRAL.accent,
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  actions: { gap: 12 },
  btn: {
    minHeight: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnEmphasis: {
    backgroundColor: HUD_NEUTRAL.accent,
    borderColor: HUD_NEUTRAL.accent,
  },
  btnDanger: { borderColor: HUD_NEUTRAL.danger },
  btnText: { color: '#F2F7F4', fontSize: 22, fontWeight: '800' },
  btnTextEmphasis: { color: HUD_NEUTRAL.bg },
  btnTextDanger: { color: HUD_NEUTRAL.danger },
  pressed: { opacity: 0.88 },
});
