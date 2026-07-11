import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, trackingLevelColor } from '@/components';
import { isInFrame } from '@/constants/visionTuning';
import { LazyCameraVerifier, useFramingCalibration } from '@/services/vision';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Turn & React framing / calibration (dev build only - reached from setup when
 * VISION_ENABLED). Presentational: the capture state machine + yaw-sign math
 * live in `useFramingCalibration`; this screen just renders the camera, the
 * in-frame indicator, and the per-phase capture button.
 */
export default function FramingScreen() {
  const router = useRouter();
  const cal = useFramingCalibration();
  const startDrill = useCallback(() => router.replace('/drill/active'), [router]);

  const captureLabel =
    cal.phase === 'center' ? 'Capture center' : 'Capture left turn';

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.cameraBox}>
        <LazyCameraVerifier style={styles.camera} onSample={cal.onSample} onTracking={cal.onTracking} />
        <View style={styles.trackPill}>
          <View style={[styles.trackDot, { backgroundColor: trackingLevelColor(cal.confidence) }]} />
          <Text style={styles.trackText}>{isInFrame(cal.confidence) ? 'In frame' : 'Step into frame'}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.kicker}>FRAMING · TURN &amp; REACT</Text>
        <Text style={styles.instruction}>{cal.instruction}</Text>

        {cal.phase === 'ready' ? (
          <Button label="Start drill" size="xl" onPress={startDrill} />
        ) : (
          <Button
            label={cal.capturing ? 'Hold…' : captureLabel}
            size="lg"
            onPress={cal.capture}
            disabled={cal.capturing}
          />
        )}

        {cal.phase !== 'ready' && cal.hasSaved ? (
          <Pressable onPress={startDrill} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Use last setup</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  cameraBox: { flex: 1, margin: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
  camera: { flex: 1 },
  trackPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,15,20,0.7)',
  },
  trackDot: { width: 10, height: 10, borderRadius: 5 },
  trackText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  panel: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  kicker: { ...typography.label, color: colors.primary, letterSpacing: 3, fontWeight: '800' },
  instruction: { ...typography.subtitle, color: colors.textPrimary, lineHeight: 24 },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
});
