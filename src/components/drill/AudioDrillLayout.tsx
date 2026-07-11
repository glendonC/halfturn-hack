import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

import { CueDisplay } from './CueDisplay';
import { DrillTimer } from './DrillTimer';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';
import { TransportControls } from './TransportControls';

/**
 * Audio-drill HUD: remaining-time on top, fading glance cue in the middle,
 * transport at the bottom. Active route stays a thin orchestrator that picks
 * a layout by mode.
 */
export function AudioDrillLayout({ engine, durationMs, cueCount }: DrillLayoutProps) {
  const paused = engine.status === 'paused';
  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.timerBox}>
        <DrillTimer
          remainingMs={engine.remainingMs}
          elapsedMs={engine.elapsedMs}
          durationMs={durationMs}
          cueCount={cueCount}
        />
      </View>

      <View style={styles.hud}>
        <CueDisplay currentCue={engine.currentCue} waiting />
        {paused ? <PausedOverlay /> : null}
      </View>

      <View style={styles.controls}>
        <TransportControls
          status={engine.status}
          onPause={engine.pause}
          onResume={engine.resume}
          onStop={engine.stop}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  timerBox: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  hud: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
