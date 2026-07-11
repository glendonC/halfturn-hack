import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraSquircle, VisionDiagnostics } from '@/components/camera';
import { colors, radius, spacing, typography } from '@/theme';
import { formatClock } from '@/utils/format';

import { CueSurface } from './CueSurface';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';
import { TransportControls } from './TransportControls';
import { TurnReactCueSurface } from './TurnReactCueSurface';
import { useDrillStore } from '@/state';

/** Bottom offset for the squircle so it floats clear of the transport bar. */
const SQUIRCLE_BOTTOM = 120;

/**
 * Immersive Turn & React layout: cue surface fills the screen; status pill,
 * self-view squircle (with tracking ring), and transport float as overlays.
 * The squircle owns its own tracking state so confidence updates never
 * re-render the cue surface.
 */
export function TurnReactLayout({ engine, cueCount }: DrillLayoutProps) {
  const paused = engine.status === 'paused';
  const currentCue = useDrillStore((s) => s.currentCue);
  const currentPhrase = useDrillStore((s) => s.currentPhrase);
  const cuesFired = engine.cueCount;

  return (
    <View style={styles.root}>
      <CueSurface>
        <TurnReactCueSurface
          cue={paused ? null : currentCue}
          phrase={paused ? null : currentPhrase}
          cueIndex={cuesFired - 1}
        />
      </CueSurface>

      <SafeAreaView
        style={styles.topSafe}
        edges={['top', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.statusPill}>
            <Text style={styles.statusTime}>
              {formatClock(engine.remainingMs / 1000)}
            </Text>
            <Text style={styles.statusMeta}>{cueCount ?? cuesFired} cues</Text>
          </View>
          <VisionDiagnostics />
        </View>
      </SafeAreaView>

      <CameraSquircle style={styles.squircle} />

      <SafeAreaView
        style={styles.bottomSafe}
        edges={['bottom', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={styles.controls}>
          <TransportControls
            compact
            status={engine.status}
            onPause={engine.pause}
            onResume={engine.resume}
            onStop={engine.stop}
          />
        </View>
      </SafeAreaView>

      {paused ? <PausedOverlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(7,20,15,0.55)',
  },
  statusTime: {
    ...typography.title,
    color: colors.textPrimary,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statusMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  squircle: {
    position: 'absolute',
    right: spacing.lg,
    bottom: SQUIRCLE_BOTTOM,
  },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
