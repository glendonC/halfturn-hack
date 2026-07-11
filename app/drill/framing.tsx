import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';
import {
  LazyCameraVerifier,
  canUseNativeVision,
  useFramingCalibration,
} from '@/services/vision';
import { colors, spacing, typography } from '@/theme';

/**
 * Turn-react framing: mount coaching always; calibration + lazy camera when
 * canUseNativeVision(). No static native imports.
 */
export default function FramingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const enterReady = useDrillStore((s) => s.enterReady);
  const mode = useDrillStore((s) => s.config.mode);
  const vision = canUseNativeVision();
  const cal = useFramingCalibration();

  useEffect(() => {
    if (mode !== 'turn_react') {
      enterReady();
      router.replace('/drill/active');
    }
  }, [mode, enterReady, router]);

  if (mode !== 'turn_react') return null;

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

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
        <Text style={styles.backLabel}>‹ Back</Text>
      </Pressable>

      {vision ? (
        <View style={styles.cameraBox}>
          <LazyCameraVerifier
            style={styles.camera}
            onSample={cal.onSample}
            onTracking={cal.onTracking}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.kicker}>Framing · Turn & React</Text>
        <Text style={styles.title}>
          {vision ? 'Calibrate stance' : 'Mount the phone'}
        </Text>
        <Text style={styles.lead}>
          {vision
            ? cal.instruction
            : 'Preview mode — no native camera on this runtime. Practice the stance; pose unlock needs a custom client with EXPO_PUBLIC_VISION=1.'}
        </Text>

        {!vision ? (
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
        ) : (
          <Text style={styles.note}>
            Tracking confidence: {(cal.confidence * 100).toFixed(0)}%
            {cal.capturing ? ' · capturing…' : ''}
          </Text>
        )}

        <Text style={styles.note}>
          {vision
            ? 'Pose samples feed RealPoseVerifier; session verification is computed on stop when a backend ran.'
            : 'Session verification stays null on Expo Go (NullPoseVerifier).'}
        </Text>
      </View>

      {vision && cal.phase !== 'ready' ? (
        <>
          <Pressable
            onPress={cal.capture}
            disabled={cal.capturing}
            style={({ pressed }) => [
              styles.primaryBtn,
              cal.capturing && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {cal.capturing ? 'Hold…' : captureLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              cal.useLastOrDefault();
            }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryBtnText}>
              {cal.hasSaved ? 'Use last setup' : 'Skip calibration'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={continueToDrill}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>
            {vision ? 'Start drill' : 'Continue'}
          </Text>
        </Pressable>
      )}
    </View>
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
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  back: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
  backLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '700',
  },
  cameraBox: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  camera: { flex: 1 },
  body: { flex: 1, gap: spacing.md },
  kicker: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '800',
  },
  title: { ...typography.title, color: colors.text, fontSize: 34 },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 24,
  },
  steps: { gap: spacing.lg, marginTop: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepN: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
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
  stepTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stepText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.88 },
});
