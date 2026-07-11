import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassScreen } from '@/components/glass';
import { CUE_ORDER, CUES } from '@/constants/cues';
import { deleteSession, listSessions } from '@/services/db';
import { accents, colors, glass, glassRadius, glassType, glow, light, spacing } from '@/theme';
import type { CueCounts, DrillSessionSummary } from '@/types';
import { formatDuration, formatSessionDate, pluralize } from '@/utils/format';

/** Slim multi-segment bar showing a session's cue mix at a glance. */
function MiniBar({ counts, total }: { counts: CueCounts; total: number }) {
  if (total <= 0) return <View style={styles.miniBar} />;
  return (
    <View style={styles.miniBar}>
      {CUE_ORDER.map((id) => {
        const c = counts[id] ?? 0;
        if (c === 0) return null;
        return <View key={id} style={{ flex: c, backgroundColor: colors[CUES[id].colorToken] }} />;
      })}
    </View>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<DrillSessionSummary[] | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch (err) {
      console.warn('[history] load failed', err);
      setSessions([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (id: string) => {
    Alert.alert('Delete session?', 'This removes the drill from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          load();
        },
      },
    ]);
  };

  return (
    <GlassScreen padded={false} accent="home">
      <FlatList
        data={sessions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.overline}>Your sessions</Text>
            <Text style={styles.title}>History</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => confirmDelete(item.id)} delayLongPress={350}>
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.date}>{formatSessionDate(item.startedAt)}</Text>
                  <View style={styles.badges}>
                    {item.verification ? (
                      <Text style={styles.verifiedTag}>◉ {item.verification.scansDetected} turns</Text>
                    ) : null}
                    {!item.completed ? <Text style={styles.stoppedTag}>stopped</Text> : null}
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{formatDuration(item.actualDurationSec)}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.meta}>{pluralize(item.totalCues, 'cue')}</Text>
                </View>
                <MiniBar counts={item.cueCounts} total={item.totalCues} />
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          sessions === null ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No drills yet</Text>
              <Text style={styles.empty}>
                Finish a session on the Home tab and it'll show up here. Long-press a session to delete it.
              </Text>
            </View>
          )
        }
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.huge * 2, gap: spacing.md },
  overline: { ...glassType.overline, marginTop: spacing.lg, color: accents.home.solid },
  title: { ...glassType.hero, fontSize: 44, marginTop: spacing.xs, marginBottom: spacing.lg },

  cardShadow: { borderRadius: glassRadius.card, ...glow.card },
  card: {
    backgroundColor: glass.fill,
    borderRadius: glassRadius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { ...glassType.subtitle, fontSize: 16 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedTag: { ...glassType.caption, color: accents.field.solid, fontWeight: '700' },
  stoppedTag: { ...glassType.caption, color: accents.data.solid, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { ...glassType.label, color: light.inkMuted },
  dot: { color: light.inkFaint },
  miniBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: glassRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(24,20,37,0.06)',
    marginTop: spacing.xs,
  },
  empty: { ...glassType.body, textAlign: 'center', lineHeight: 22 },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.huge, paddingHorizontal: spacing.lg },
  emptyTitle: { ...glassType.title, color: light.inkSoft },
});
