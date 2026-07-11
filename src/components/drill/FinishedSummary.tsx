import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrillStore } from '@/state';
import { colors, spacing, typography } from '@/theme';

import { formatDurationMs, summarizeCueDistribution } from './sessionStats';

export function FinishedSummary({
  onDone,
  onRepeat,
}: {
  onDone: () => void;
  onRepeat?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cueEvents = useDrillStore((s) => s.cueEvents);
  const durationDrillMs = useDrillStore((s) => s.durationDrillMs);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const config = useDrillStore((s) => s.config);
  const persistStatus = useDrillStore((s) => s.persistStatus);
  const persistError = useDrillStore((s) => s.persistError);

  const distribution = summarizeCueDistribution(cueEvents);

  const saveLabel =
    persistStatus === 'saving'
      ? 'Saving to this device…'
      : persistStatus === 'saved'
        ? 'Saved on this device — see History.'
        : persistStatus === 'error'
          ? `Save issue: ${persistError ?? 'unknown'}`
          : 'Session finished.';

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
      <Text style={styles.subtitle}>{saveLabel}</Text>

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

      <Text style={styles.sectionTitle}>Cue timeline</Text>
      {cueEvents.length === 0 ? (
        <Text style={styles.empty}>Empty timeline</Text>
      ) : (
        cueEvents.map((cue) => (
          <View key={cue.id} style={styles.timelineRow}>
            <Text style={styles.timelineIndex}>#{cue.index + 1}</Text>
            <View style={styles.timelineBody}>
              <Text style={styles.timelinePhrase}>{cue.phrase}</Text>
              <Text style={styles.timelineMeta}>{cue.cueId}</Text>
            </View>
            <Text style={styles.timelineTime}>
              {(cue.onsetDrillMs / 1000).toFixed(1)}s
            </Text>
          </View>
        ))
      )}

      <Text style={styles.honesty}>
        Verification metrics stay empty for audio-only sessions (not zero).
      </Text>

      <View style={styles.actions}>
        {onRepeat ? (
          <Pressable
            onPress={onRepeat}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryBtnText}>Repeat</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Done</Text>
        </Pressable>
      </View>
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
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timelineIndex: { color: colors.textMuted, width: 36, fontWeight: '600' },
  timelineBody: { flex: 1, gap: 2 },
  timelinePhrase: { color: colors.text, fontSize: 17, fontWeight: '700' },
  timelineMeta: { color: colors.textMuted, fontSize: 13 },
  timelineTime: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  honesty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
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
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: { opacity: 0.88 },
});
