import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DrillConfig } from '@/types';
import { colors, spacing, typography } from '@/theme';

/**
 * Optional pre-drill ready view (summary + start/test). Presentational —
 * Train currently starts countdown from setup; this seam lets active own
 * a ready step later without rewriting chrome.
 */
export function DrillReadyView({
  config,
  onStart,
  onTest,
  onBack,
}: {
  config: DrillConfig;
  onStart: () => void;
  onTest: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const minutes = Math.round(config.durationMs / 60_000);
  const modeLabel =
    config.mode === 'turn_react' ? 'Turn & React preview' : 'Spoken cues';

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
      <Pressable onPress={onBack} hitSlop={16} style={styles.back}>
        <Text style={styles.backLabel}>‹ Back</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.kicker}>Ready to train</Text>
        <Text style={styles.duration}>{minutes} min</Text>
        <Text style={styles.meta}>
          {modeLabel} · {config.enabledCues.length} cue types
        </Text>
        <Text style={styles.meta}>
          Interval {(config.intervalMs.min / 1000).toFixed(1)}–
          {(config.intervalMs.max / 1000).toFixed(1)}s
        </Text>

        <Pressable
          onPress={onTest}
          style={({ pressed }) => [styles.testBtn, pressed && styles.pressed]}
        >
          <Text style={styles.testLabel}>Test sound</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onStart}
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryBtnText}>Start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  back: { paddingVertical: spacing.sm },
  backLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  kicker: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '800',
  },
  duration: {
    fontSize: 56,
    fontWeight: '900',
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  testBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  testLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
