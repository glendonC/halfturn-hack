import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isVariableCue } from '@/constants';
import { useDrillStore } from '@/state';

import { AudioCueSurface } from './AudioCueSurface';
import { CueSurface } from './CueSurface';
import { CUE_CATEGORY_FLOOD, HUD_NEUTRAL } from './cueColors';
import { DrillTimer } from './DrillTimer';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';
import { TransportControls } from './TransportControls';

/** Audio-mode running layout (AudioDrillLayout). */
export function AudioDrillLayout({ engine, durationMs, cueCount }: DrillLayoutProps) {
  const insets = useSafeAreaInsets();
  const currentCue = useDrillStore((s) => s.currentCue);
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const status = engine.status;
  const cuesFired = engine.cueCount;

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
      <DrillTimer
        remainingMs={engine.remainingMs}
        elapsedMs={engine.elapsedMs}
        durationMs={durationMs}
        cueCount={cueCount}
      />

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
        {engine.timeRemainingLabel}
      </Text>

      <TransportControls
        status={status}
        onPause={engine.pause}
        onResume={engine.resume}
        onStop={engine.stop}
      />

      {paused ? <PausedOverlay /> : null}
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
