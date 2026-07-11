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
import { useDrillStore } from '@/state';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Turn-react framing: mount coaching on Expo Go; calibration + lazy camera
 * when canUseNativeVision(). No static native imports.
 */
export default function FramingScreen() {
  const router = useRouter();
  const enterReady = useDrillStore((s) => s.enterReady);
  const mode = useDrillStore((s) => s.config.mode);
  const vision = canUseNativeVision();
  const cal = useFramingCalibration();

  useEffect(() => {
    if (mode !== 'turn-react') {
      enterReady();
      router.replace('/drill/active');
    }
  }, [mode, enterReady, router]);

  if (mode !== 'turn-react') return null;

  const continueToDrill = () => {
    enterReady();
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
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </Pressable>
        <View style={styles.panel}>
          <Text style={styles.kicker}>FRAMING · TURN & REACT</Text>
          <Text style={styles.title}>Mount the phone</Text>
          <Text style={styles.instruction}>
            Preview mode — no native camera on this runtime. Practice the
            stance; pose unlock needs a custom client with EXPO_PUBLIC_VISION=1.
          </Text>
          <View style={styles.steps}>
            <Step
              n="1"
              title="Distance"
              body="Set the phone 2–4 m away at chest height, screen facing you."
            />
            <Step
              n="2"
              title="Stance"
              body="Start with your back to the camera. Half-turn to read each cue."
            />
            <Step
              n="3"
              title="Quiet room"
              body="Headphones on. A beep marks onset; the screen holds the value."
            />
          </View>
          <Button label="Continue" size="xl" onPress={continueToDrill} />
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
        <Text style={styles.kicker}>FRAMING · TURN & REACT</Text>
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

        {cal.phase !== 'ready' ? (
          <Pressable
            onPress={() => cal.useLastOrDefault()}
            hitSlop={8}
            style={styles.skip}
          >
            <Text style={styles.skipText}>
              {cal.hasSaved ? 'Use last setup' : 'Skip calibration'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepN}>{n}</Text>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  back: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '700',
  },
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
    backgroundColor: 'rgba(7,20,15,0.7)',
  },
  trackDot: { width: 10, height: 10, borderRadius: 5 },
  trackText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  panel: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 3,
    fontWeight: '800',
  },
  title: { ...typography.title, color: colors.textPrimary },
  instruction: {
    ...typography.subtitle,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  steps: { gap: spacing.lg, marginTop: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepN: {
    width: 36,
    height: 36,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 36,
    backgroundColor: colors.surface,
    color: colors.accent,
    fontWeight: '900',
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBody: { flex: 1, gap: 4 },
  stepTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  stepText: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
