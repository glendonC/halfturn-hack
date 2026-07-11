import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DrillConfig } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDuration, formatSeconds, pluralize } from '@/utils/format';
import { Button } from '../Button';

interface DrillReadyViewProps {
  config: DrillConfig;
  onStart: () => void;
  onTest: () => void;
  onBack: () => void;
}

/**
 * Pre-drill "ready" screen: drill summary, an audio-check button, and Start.
 * Presentational — all drill lifecycle lives in the engine; the active screen
 * wires the callbacks.
 */
export function DrillReadyView({
  config,
  onStart,
  onTest,
  onBack,
}: DrillReadyViewProps) {
  const durationSec = Math.round(config.durationMs / 1000);
  const intervalMinSec = config.intervalMs.min / 1000;
  const intervalMaxSec = config.intervalMs.max / 1000;

  return (
    <SafeAreaView style={styles.wrap}>
      <Pressable onPress={onBack} hitSlop={16} style={styles.back}>
        <Text style={styles.backLabel}>‹ Back</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.kicker}>READY TO TRAIN</Text>
        <Text style={styles.duration}>{formatDuration(durationSec)}</Text>
        <Text style={styles.meta}>
          {pluralize(config.enabledCues.length, 'cue type')} · every{' '}
          {formatSeconds(intervalMinSec)}–{formatSeconds(intervalMaxSec)}
        </Text>

        <Pressable onPress={onTest} style={styles.testBtn} hitSlop={8}>
          <Text style={styles.testLabel}>Test sound</Text>
        </Pressable>
        <Text style={styles.tip}>
          Put your headphones in. On iPhone, make sure the silent switch is OFF
          so cues are audible.
        </Text>
      </View>

      <Button label="Start" size="xl" onPress={onStart} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  back: { paddingVertical: spacing.md },
  backLabel: {
    ...typography.subtitle,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  kicker: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 3,
    fontWeight: '800',
  },
  duration: { ...typography.hero, color: colors.textPrimary },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  testBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  testLabel: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  tip: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
