import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trackingLevelColor } from '@/components/camera';
import { Button } from '@/components/Button';
import { isInFrame } from '@/constants/visionTuning';
import {
  LazyCameraVerifier,
  canUseNativeVision,
  useFramingCalibration,
} from '@/services/vision';
import { useDrillConfigStore } from '@/state';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Turn-react framing: mount coaching on Expo Go; calibration + lazy camera
 * when canUseNativeVision(). No static native imports.
 */
export default function FramingScreen() {
  const router = useRouter();
  const mode = useDrillConfigStore((s) => s.config.mode);
  const vision = canUseNativeVision();
  const cal = useFramingCalibration();

  useEffect(() => {
    if (mode !== 'turn-react') {
      router.replace('/drill/active');
    }
  }, [mode, router]);

  if (mode !== 'turn-react') return null;

  const continueToDrill = () => {
    router.replace('/drill/active');
  };

  const captureLabel =
    cal.phase === 'center'
      ? 'Capture center'
      : cal.phase === 'left'
        ? 'Capture left turn'
        : 'Start drill';

  if (!vision) {
    return (
      <SafeAreaView style={styles.wrap}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>FRAMING · TURN &amp; REACT</Text>
          <Text style={styles.instruction}>
            Mount the phone facing you at chest height. Camera calibration needs
            a development build; you can still run the beep preview from here.
          </Text>
          <Button label="Start drill" size="xl" onPress={continueToDrill} />
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.cameraBox}>
        <LazyCameraVerifier
          style={styles.camera}
          onSample={cal.onSample}
          onTracking={cal.onTracking}
        />
        <View style={styles.trackPill}>
          <View
            style={[
              styles.trackDot,
              { backgroundColor: trackingLevelColor(cal.confidence) },
            ]}
          />
          <Text style={styles.trackText}>
            {isInFrame(cal.confidence) ? 'In frame' : 'Step into frame'}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.kicker}>FRAMING · TURN &amp; REACT</Text>
        <Text style={styles.instruction}>{cal.instruction}</Text>

        {cal.phase === 'ready' ? (
          <Button label="Start drill" size="xl" onPress={continueToDrill} />
        ) : (
          <Button
            label={cal.capturing ? 'Hold…' : captureLabel}
            size="lg"
            onPress={cal.capture}
            disabled={cal.capturing}
          />
        )}

        {cal.phase !== 'ready' && cal.hasSaved ? (
          <Pressable onPress={continueToDrill} hitSlop={8} style={styles.skip}>
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
  cameraBox: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
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
  trackText: { ...typography.caption, color: colors.text },
  panel: { padding: spacing.xl, gap: spacing.md },
  kicker: { ...typography.caption, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  instruction: { ...typography.body, color: colors.text, marginBottom: spacing.sm },
  skip: { alignSelf: 'center', paddingVertical: spacing.sm },
  skipText: { ...typography.caption, color: colors.textMuted },
});
