import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isVariableCue } from '@/constants';
import { formatRemainingClock, useDrillStore } from '@/state';

import { AudioCueSurface } from './AudioCueSurface';
import { CueSurface } from './CueSurface';
import { CUE_CATEGORY_FLOOD, HUD_NEUTRAL } from './cueColors';
import { TransportControls } from './TransportControls';

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

      <CueSurface>
        <AudioCueSurface
          label={label}
          textColor={flood.text}
          side={paused ? 'none' : (currentCue?.side ?? 'none')}
        />
      </CueSurface>

      <Text style={[styles.timer, { color: flood.text }]}>
        {formatRemainingClock(timeRemainingMs)}
      </Text>

      <TransportControls
        status={status}
        onPause={pause}
        onResume={resume}
        onStop={stop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    gap: 16,
  },
  meta: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timer: {
    fontSize: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    opacity: 0.95,
  },
});
