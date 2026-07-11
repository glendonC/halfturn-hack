import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDurationMs } from '@/components/drill/sessionStats';
import { listSessions, rollupSessions } from '@/services/db';
import { colors, spacing, typography } from '@/theme';

/** Render null metrics as an em dash — never fake 0%. */
function metricDisplay(value: number | null, suffix = ''): string {
  if (value == null) return '—';
  return `${value}${suffix}`;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rollup, setRollup] = useState(() => rollupSessions([]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessions = await listSessions(200);
      setRollup(rollupSessions(sessions));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const empty = !loading && rollup.sessionCount === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>
        Local rollups only. Verification stays blank until pose evidence exists.
      </Text>

      {loading && rollup.sessionCount === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.emptyBody}>
            Finish a Train drill and totals will build up here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Stat label="Sessions" value={String(rollup.sessionCount)} />
            <Stat
              label="Total time"
              value={formatDurationMs(rollup.totalDurationMs)}
            />
            <Stat label="Cues fired" value={String(rollup.totalCues)} />
          </View>

          <Text style={styles.sectionTitle}>Mode mix</Text>
          <View style={styles.card}>
            <Stat label="Audio" value={String(rollup.audioSessions)} />
            <Stat
              label="Turn & React"
              value={String(rollup.turnReactSessions)}
            />
          </View>

          <Text style={styles.sectionTitle}>Checks</Text>
          <View style={styles.card}>
            <Stat label="Left" value={String(rollup.leftChecks)} />
            <Stat label="Right" value={String(rollup.rightChecks)} />
          </View>

          <Text style={styles.sectionTitle}>Cue mix</Text>
          {rollup.cueMix.length === 0 ? (
            <Text style={styles.emptyBody}>No cues recorded.</Text>
          ) : (
            rollup.cueMix.map((row) => (
              <View key={row.cueId} style={styles.distRow}>
                <Text style={styles.distLabel}>{row.label}</Text>
                <Text style={styles.distCount}>{row.count}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Verification</Text>
          <Text style={styles.honesty}>
            Evidence-weighted metrics stay empty for audio and turn-react
            preview (not zero).
          </Text>
          <View style={styles.card}>
            <Stat
              label="Scanned before action"
              value={metricDisplay(
                rollup.scannedBeforeActionRate == null
                  ? null
                  : Math.round(rollup.scannedBeforeActionRate * 100),
                '%',
              )}
            />
            <Stat
              label="Mean reaction"
              value={
                rollup.meanReactionMs == null
                  ? '—'
                  : `${rollup.meanReactionMs}ms`
              }
            />
            <Stat
              label="Anticipation"
              value={metricDisplay(
                rollup.anticipationRate == null
                  ? null
                  : Math.round(rollup.anticipationRate * 100),
                '%',
              )}
            />
          </View>
        </>
      )}
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
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  honesty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stat: { gap: 2 },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  distRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  distLabel: { color: colors.text, fontSize: 18, fontWeight: '600' },
  distCount: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  empty: { marginTop: 32, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
});
