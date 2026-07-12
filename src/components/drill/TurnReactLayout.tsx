import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraSquircle, VisionDiagnostics } from '@/components/camera';
import { GlassSurface } from '@/components/glass';
import { colors, glass, glassRadius, glassType, glow, light, spacing } from '@/theme';
import { formatClock } from '@/utils/format';
import { CueSurface } from './CueSurface';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';
import { TransportControls } from './TransportControls';
import { TurnReactCueDisplay } from './TurnReactCueDisplay';

/** Bottom offset for the squircle so it floats clear of the transport bar. */
const SQUIRCLE_BOTTOM = 120;

/**
 * FaceTime-style Turn & React layout: cue surface stays full-bleed for outdoor
 * readability; floating chrome (status + transport) uses the same liquid glass
 * as Home / framing so the between-drill and in-drill chrome feel continuous.
 */
export function TurnReactLayout({ engine, cueCount }: DrillLayoutProps) {
  const paused = engine.status === 'paused';
  return (
    <View style={styles.root}>
      <CueSurface>
        <TurnReactCueDisplay currentCue={engine.currentCue} />
      </CueSurface>

      <SafeAreaView style={styles.topSafe} edges={['top', 'left', 'right']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={[styles.statusShadow, glow.floating]}>
            <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.statusPill}>
              <Text style={styles.statusTime}>{formatClock(engine.remainingMs / 1000)}</Text>
              <Text style={styles.statusMeta}>{cueCount} cues</Text>
            </GlassSurface>
          </View>
          <VisionDiagnostics />
        </View>
      </SafeAreaView>

      <CameraSquircle style={styles.squircle} />

      <SafeAreaView style={styles.bottomSafe} edges={['bottom', 'left', 'right']} pointerEvents="box-none">
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
  statusShadow: { borderRadius: glassRadius.pill },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusTime: {
    ...glassType.subtitle,
    color: light.ink,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusMeta: { ...glassType.caption, color: light.inkMuted, fontWeight: '600' },
  squircle: { position: 'absolute', right: spacing.lg, bottom: SQUIRCLE_BOTTOM },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
});
