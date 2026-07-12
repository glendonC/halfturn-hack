import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraSquircle, VisionDiagnostics } from '@/components/camera';
import { GlassSurface, Icon, Icons } from '@/components/glass';
import { useDrillStore, type ScanConfirm } from '@/state/useDrillStore';
import { accents, glass, glassRadius, glassType, glow, light, spacing } from '@/theme';
import { formatClock } from '@/utils/format';
import { CueSurface } from './CueSurface';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';
import { TransportControls } from './TransportControls';
import { TurnReactCueDisplay } from './TurnReactCueDisplay';

/** Bottom offset for the squircle so it floats clear of the transport bar. */
const SQUIRCLE_BOTTOM = 120;
/** How long the verified-turn chip stays up (in + hold + out). */
const CONFIRM_IN_MS = 140;
const CONFIRM_HOLD_MS = 900;
const CONFIRM_OUT_MS = 260;

/**
 * FaceTime-style Turn & React layout: cue surface stays full-bleed for outdoor
 * readability; floating chrome (status + transport) uses the same liquid glass
 * as Home / framing so the between-drill and in-drill chrome feel continuous.
 */
export function TurnReactLayout({ engine, cueCount }: DrillLayoutProps) {
  const paused = engine.status === 'paused';
  const verifiedCount = useDrillStore((s) => s.verifiedCount);
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
              {/* Live score: camera-verified turns over cues fired — the always-on
                  "it is watching and scoring me" readout. */}
              <Text style={styles.statusMeta}>
                {verifiedCount}/{cueCount} <Text style={styles.statusCheck}>✓</Text>
              </Text>
            </GlassSurface>
          </View>
          <VisionDiagnostics />
        </View>
      </SafeAreaView>

      <CameraSquircle style={styles.squircle} />
      <VerifiedTurnChip />

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

/**
 * Transient "turn verified" chip above the self-view — the visible half of the
 * live cue → turn → confirm loop (the ding + success haptic are the eyes-off
 * half). Subscribes to the runtime store's scanConfirm itself, so the ~few
 * confirms per minute re-render only this chip, never the cue surface.
 */
function VerifiedTurnChip() {
  const confirm = useDrillStore((s) => s.scanConfirm);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!confirm) return;
    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: CONFIRM_IN_MS,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.delay(CONFIRM_HOLD_MS),
      Animated.timing(anim, {
        toValue: 0,
        duration: CONFIRM_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [confirm, anim]);

  if (!confirm) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.verifiedWrap,
        glow.floating,
        {
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
          ],
        },
      ]}
    >
      <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.verifiedPill}>
        <View style={styles.verifiedBadge}>
          <Icon icon={Icons.Check} size={11} color={light.white} strokeWidth={3} />
        </View>
        <Text style={styles.verifiedText}>
          {confirm.direction === 'left' ? 'Left turn' : 'Right turn'}
        </Text>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: light.base },
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
  statusCheck: { color: accents.home.solid, fontWeight: '700' },
  squircle: { position: 'absolute', right: spacing.lg, bottom: SQUIRCLE_BOTTOM },
  verifiedWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: SQUIRCLE_BOTTOM + 156 + spacing.sm, // floats just above the self-view
    borderRadius: glassRadius.pill,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accents.home.solid,
  },
  verifiedText: { ...glassType.caption, color: light.inkSoft, fontWeight: '700' },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
});
