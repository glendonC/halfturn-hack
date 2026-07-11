import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRemainingClock, useDrillStore } from '@/state';

import { CueSurface } from './CueSurface';
import { HUD_NEUTRAL } from './cueColors';
import { TransportControls } from './TransportControls';
import { TurnReactCueSurface } from './TurnReactCueSurface';

/**
 * Turn-react active shell: visual cue surface + shared transport (no camera).
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

      <CueSurface>
        <TurnReactCueSurface
          cue={paused ? null : currentCue}
          phrase={paused ? null : currentPhrase}
          cueIndex={cuesFired - 1}
        />
      </CueSurface>

      <Text style={styles.timer}>{formatRemainingClock(timeRemainingMs)}</Text>

      <TransportControls
        compact
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
});
