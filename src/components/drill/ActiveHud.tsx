import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isVariableCue } from '@/constants';
import { formatRemainingClock, useDrillStore } from '@/state';

import { CUE_CATEGORY_FLOOD, HUD_NEUTRAL } from './cueColors';

export function ActiveHud() {
  const insets = useSafeAreaInsets();
  const status = useDrillStore((s) => s.status);
  const currentCue = useDrillStore((s) => s.currentCue);
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const timeRemainingMs = useDrillStore((s) => s.timeRemainingMs);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const pause = useDrillStore((s) => s.pause);
  const resume = useDrillStore((s) => s.resume);
  const stop = useDrillStore((s) => s.stop);

  const flood = currentCue
    ? CUE_CATEGORY_FLOOD[currentCue.category]
    : { bg: HUD_NEUTRAL.bg, text: HUD_NEUTRAL.accent };
  const paused = status === 'paused';
  const label = paused
    ? 'PAUSED'
    : currentCue && isVariableCue(currentCue.id) && currentPhrase
      ? currentPhrase.toUpperCase()
      : (currentCue?.hudLabel ?? 'LISTEN');

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: flood.bg,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text style={[styles.meta, { color: flood.text }]}>
        {paused ? 'Paused' : 'Live'} · {cuesFired} cues
      </Text>

      <View style={styles.center}>
        <Text
          style={[styles.cue, { color: flood.text }]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
        <Text style={[styles.timer, { color: flood.text }]}>
          {formatRemainingClock(timeRemainingMs)}
        </Text>
      </View>

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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  cue: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 78,
  },
  timer: {
    fontSize: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    opacity: 0.95,
  },
  actions: {
    gap: 12,
  },
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
