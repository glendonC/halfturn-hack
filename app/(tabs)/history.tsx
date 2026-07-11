import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDurationMs } from '@/components/drill/sessionStats';
import {
  formatSessionWhen,
  listSessions,
  shortDistributionLabel,
  type StoredSessionSummary,
} from '@/services/db';
import { colors, spacing, typography } from '@/theme';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await listSessions();
      setSessions(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>On-device sessions only — nothing leaves this phone.</Text>

      {loading && sessions.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 40,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyBody}>
                Finish a Train drill and it will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/session/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardWhen}>
                {formatSessionWhen(item.startedAtWallMs)}
              </Text>
              <Text style={styles.cardMeta}>
                {formatDurationMs(item.durationDrillMs)} · {item.cueCount} cues
              </Text>
              <Text style={styles.cardDist} numberOfLines={2}>
                {shortDistributionLabel(item.distribution)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardWhen: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardMeta: { color: colors.accent, fontWeight: '600' },
  cardDist: { color: colors.textMuted, marginTop: 2 },
  empty: {
    marginTop: 48,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
  pressed: { opacity: 0.88 },
});
