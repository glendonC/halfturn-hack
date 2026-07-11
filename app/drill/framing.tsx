import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';
import { colors, spacing, typography } from '@/theme';

/**
 * Turn-react framing stub — mount/stance coaching only.
 * No VisionCamera, no calibration samples, NullPoseVerifier path only.
 */
export default function FramingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const startCountdown = useDrillStore((s) => s.startCountdown);
  const mode = useDrillStore((s) => s.config.mode);

  // Audio mode should never land here; bounce to active.
  useEffect(() => {
    if (mode !== 'turn_react') {
      startCountdown();
      router.replace('/drill/active');
    }
  }, [mode, startCountdown, router]);

  if (mode !== 'turn_react') return null;

  const continueToDrill = () => {
    startCountdown();
    router.replace('/drill/active');
  };

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

      <View style={styles.body}>
        <Text style={styles.kicker}>Framing · Turn & React</Text>
        <Text style={styles.title}>Mount the phone</Text>
        <Text style={styles.lead}>
          Preview mode — no camera yet. Practice the stance so Phase 2 can plug
          in without rewriting this step.
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

        <Text style={styles.note}>
          Verification stays null (NullPoseVerifier). Pose unlock is a later
          Phase 2 gate.
        </Text>
      </View>

      <Pressable
        onPress={continueToDrill}
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
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
    marginTop: spacing.lg,
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
  pressed: { opacity: 0.88 },
});
