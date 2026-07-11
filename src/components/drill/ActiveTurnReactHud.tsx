import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';

import { CueSurface } from './CueSurface';
import { HUD_NEUTRAL } from './cueColors';
import type { DrillLayoutProps } from './layoutProps';
import { TransportControls } from './TransportControls';
import { TurnReactCueSurface } from './TurnReactCueSurface';

/**
 * Turn-react active shell: visual cue surface + shared transport (no camera).
 */
export function ActiveTurnReactHud({ engine }: DrillLayoutProps) {
  const insets = useSafeAreaInsets();
  const currentCue = useDrillStore((s) => s.currentCue);
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const status = engine.status;
  const cuesFired = engine.cueCount;
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

      <Text style={styles.timer}>{engine.timeRemainingLabel}</Text>

      <TransportControls
        compact
        status={status}
        onPause={engine.pause}
        onResume={engine.resume}
        onStop={engine.stop}
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
