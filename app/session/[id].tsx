import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDurationMs } from '@/components/drill/sessionStats';
import {
  formatSessionWhen,
  getSession,
  type StoredSessionDetail,
} from '@/services/db';
import { colors, spacing, typography } from '@/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StoredSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        setLoading(true);
        const row = id ? await getSession(id) : null;
        if (alive) {
          setSession(row);
          setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [id]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← History</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : !session ? (
        <Text style={styles.missing}>Session not found.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 40,
            gap: spacing.md,
          }}
        >
          <Text style={styles.title}>Session</Text>
          <Text style={styles.when}>
            {formatSessionWhen(session.startedAtWallMs)}
          </Text>
          <View style={styles.card}>
            <Text style={styles.stat}>
              {formatDurationMs(session.durationDrillMs)}
            </Text>
            <Text style={styles.meta}>{session.cueCount} cues</Text>
            <Text style={styles.meta}>
              {session.mode === 'audio' ? 'Audio' : 'Turn & React preview'}
            </Text>
          </View>

          <Text style={styles.section}>Distribution</Text>
          {session.distribution.length === 0 ? (
            <Text style={styles.meta}>No cues</Text>
          ) : (
            session.distribution.map((row) => (
              <View key={row.cueId} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.count}</Text>
              </View>
            ))
          )}

          <Text style={styles.section}>Cue timeline</Text>
          <Text style={styles.meta}>
            Spoken phrase at onset (variable cues show the resolved value).
          </Text>
          {session.cues.length === 0 ? (
            <Text style={styles.meta}>Empty timeline</Text>
          ) : (
            session.cues.map((cue) => (
              <View key={cue.id} style={styles.timelineRow}>
                <Text style={styles.timelineIndex}>#{cue.index + 1}</Text>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineLabel}>{cue.label}</Text>
                  <Text style={styles.timelineMeta}>
                    {cue.cueId}
                    {cue.plannedOffsetMs !== cue.onsetDrillMs
                      ? ` · planned ${(cue.plannedOffsetMs / 1000).toFixed(1)}s`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.timelineTime}>
                  {(cue.onsetDrillMs / 1000).toFixed(1)}s
                </Text>
              </View>
            ))
          )}

          <Text style={styles.honesty}>
            No pose verification on these sessions — rates stay blank, not zero.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  missing: {
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  title: { ...typography.title, color: colors.text },
  when: { color: colors.textMuted, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  stat: { color: colors.text, fontSize: 28, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 16 },
  section: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.text, fontWeight: '600', fontSize: 16 },
  rowValue: { color: colors.accent, fontWeight: '800', fontSize: 16 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timelineIndex: { color: colors.textMuted, width: 36, fontWeight: '600' },
  timelineBody: { flex: 1, gap: 2 },
  timelineLabel: { color: colors.text, flex: 1, fontWeight: '700' },
  timelineMeta: { color: colors.textMuted, fontSize: 13 },
  timelineTime: { color: colors.textMuted, fontVariant: ['tabular-nums'] },
  honesty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
