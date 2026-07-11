import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';
import { colors, spacing, typography } from '@/theme';

import { formatDurationMs, summarizeCueDistribution } from './sessionStats';

export function FinishedSummary() {
  const insets = useSafeAreaInsets();
  const cueEvents = useDrillStore((s) => s.cueEvents);
  const durationDrillMs = useDrillStore((s) => s.durationDrillMs);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const config = useDrillStore((s) => s.config);
  const reset = useDrillStore((s) => s.reset);

  const distribution = summarizeCueDistribution(cueEvents);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>Session done</Text>
      <Text style={styles.subtitle}>On-device summary — not saved yet.</Text>

      <View style={styles.card}>
        <Stat label="Duration" value={formatDurationMs(durationDrillMs)} />
        <Stat label="Cues" value={String(cuesFired)} />
        <Stat
          label="Mode"
          value={config.mode === 'audio' ? 'Audio' : 'Turn & React preview'}
        />
      </View>

      <Text style={styles.sectionTitle}>Distribution</Text>
      {distribution.length === 0 ? (
        <Text style={styles.empty}>No cues fired.</Text>
      ) : (
        distribution.map((row) => (
          <View key={row.cueId} style={styles.distRow}>
            <Text style={styles.distLabel}>{row.label}</Text>
            <Text style={styles.distCount}>{row.count}</Text>
          </View>
        ))
      )}

      <Pressable
        onPress={reset}
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryBtnText}>Back to setup</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stat: { gap: 2 },
  statLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  empty: { color: colors.textMuted },
  distRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  distLabel: { color: colors.text, fontSize: 18, fontWeight: '600' },
  distCount: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  primaryBtn: {
    marginTop: spacing.xl,
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
