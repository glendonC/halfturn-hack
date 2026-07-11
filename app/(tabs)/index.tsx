import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillSession } from '@/hooks';
import {
  formatRemainingClock,
  selectCurrentCueLabel,
  useDrillStore,
} from '@/state';
import { colors, spacing, typography } from '@/theme';

export default function TrainScreen() {
  useDrillSession();
  const insets = useSafeAreaInsets();

  const status = useDrillStore((s) => s.status);
  const timeRemainingMs = useDrillStore((s) => s.timeRemainingMs);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const cueLabel = useDrillStore(selectCurrentCueLabel);
  const countdownRemainingSec = useDrillStore((s) => s.countdownRemainingSec);

  const enterReady = useDrillStore((s) => s.enterReady);
  const startCountdown = useDrillStore((s) => s.startCountdown);
  const pause = useDrillStore((s) => s.pause);
  const resume = useDrillStore((s) => s.resume);
  const stop = useDrillStore((s) => s.stop);
  const reset = useDrillStore((s) => s.reset);
  const testSound = useDrillStore((s) => s.testSound);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>Train</Text>
      <Text style={styles.meta}>Status: {status}</Text>

      <View style={styles.panel}>
        <Text style={styles.cueLabel}>
          {status === 'countdown'
            ? String(countdownRemainingSec)
            : (cueLabel ?? '—')}
        </Text>
        <Text style={styles.timer}>{formatRemainingClock(timeRemainingMs)}</Text>
        <Text style={styles.meta}>Cues fired: {cuesFired}</Text>
      </View>

      <View style={styles.actions}>
        {(status === 'idle' || status === 'finished') && (
          <Action label="Ready" onPress={enterReady} />
        )}
        {status === 'ready' && (
          <Action label="Start" onPress={startCountdown} primary />
        )}
        {status === 'running' && (
          <>
            <Action label="Pause" onPress={pause} />
            <Action label="Stop" onPress={stop} danger />
          </>
        )}
        {status === 'paused' && (
          <>
            <Action label="Resume" onPress={resume} primary />
            <Action label="Stop" onPress={stop} danger />
          </>
        )}
        {status === 'countdown' && (
          <Action label="Stop" onPress={stop} danger />
        )}
        {status === 'finished' && (
          <Action label="Reset" onPress={reset} />
        )}
        <Action label="Test sound" onPress={() => void testSound()} quiet />
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  primary,
  danger,
  quiet,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        danger && styles.buttonDanger,
        quiet && styles.buttonQuiet,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          primary && styles.buttonTextPrimary,
          danger && styles.buttonTextDanger,
          quiet && styles.buttonTextQuiet,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.textMuted,
  },
  panel: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  cueLabel: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -0.5,
  },
  timer: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonDanger: {
    borderColor: colors.danger,
  },
  buttonQuiet: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: colors.bg,
  },
  buttonTextDanger: {
    color: colors.danger,
  },
  buttonTextQuiet: {
    color: colors.textMuted,
  },
});
