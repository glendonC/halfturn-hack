import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassActionPill,
  GlassPageHeader,
  GlassScreen,
  Icon,
  Icons,
} from '@/components/glass';
import { CUE_ORDER, CUES } from '@/constants/cues';
import { clearAllSessions, deleteSessions, listSessions } from '@/services/db';
import { accents, animateNext, colors, glass, glassRadius, glassType, glow, light, spacing } from '@/theme';
import type { CueCounts, DrillSessionSummary } from '@/types';
import { formatDuration, formatSessionDate, pluralize } from '@/utils/format';

/** Space the floating nav reserves at the bottom. */
const NAV_CLEARANCE = 96;

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

/** Selection checkbox — empty glass circle, or filled coral check when selected. */
function SelectMark({ selected }: { selected: boolean }) {
  return (
    <View
      style={[styles.selectMark, selected && styles.selectMarkOn]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {selected ? <Icon icon={Icons.Check} size={14} color={light.white} strokeWidth={3} /> : null}
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<DrillSessionSummary[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

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
      void load();
      setSelecting(false);
      setSelected(new Set());
    }, [load]),
  );

  const selectedCount = selected.size;
  const allIds = useMemo(() => (sessions ?? []).map((s) => s.id), [sessions]);
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const hasSessions = (sessions?.length ?? 0) > 0;

  const enterSelect = (initialId?: string) => {
    animateNext();
    setSelecting(true);
    setSelected(initialId ? new Set([initialId]) : new Set());
  };

  const exitSelect = () => {
    animateNext();
    setSelecting(false);
    setSelected(new Set());
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const confirmDeleteSelected = () => {
    if (selectedCount === 0) return;
    const n = selectedCount;
    Alert.alert(
      n === 1 ? 'Delete session?' : `Delete ${n} sessions?`,
      n === 1
        ? 'This removes the drill from your history.'
        : 'This permanently removes the selected drills from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSessions(Array.from(selected));
            setSelected(new Set());
            setSelecting(false);
            await load();
          },
        },
      ],
    );
  };

  const confirmClearAll = () => {
    Alert.alert('Clear all history?', 'This permanently deletes every saved drill.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          await clearAllSessions();
          setSelected(new Set());
          setSelecting(false);
          await load();
        },
      },
    ]);
  };

  const headerActions = !hasSessions ? undefined : selecting ? (
    <>
      <GlassActionPill label={allSelected ? 'None' : 'All'} onPress={toggleAll} />
      <GlassActionPill
        label={selectedCount === 0 ? 'Delete' : `Delete ${selectedCount}`}
        icon={Icons.Trash2}
        danger
        disabled={selectedCount === 0}
        onPress={confirmDeleteSelected}
      />
      <GlassActionPill label="Done" icon={Icons.Check} active accent="home" onPress={exitSelect} />
    </>
  ) : (
    <>
      <GlassActionPill label="Clear" icon={Icons.Trash2} danger onPress={confirmClearAll} />
      <GlassActionPill label="Select" onPress={() => enterSelect()} accent="home" />
    </>
  );

  return (
    <GlassScreen padded={false} accent="home">
      <FlatList
        data={sessions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + NAV_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
        extraData={{ selecting, selectedCount }}
        ListHeaderComponent={<GlassPageHeader title="History" actions={headerActions} />}
        renderItem={({ item }) => {
          const isOn = selected.has(item.id);
          return (
            <Pressable
              onPress={() => {
                if (selecting) toggleOne(item.id);
                else enterSelect(item.id);
              }}
              accessibilityRole={selecting ? 'checkbox' : 'button'}
              accessibilityState={selecting ? { checked: isOn } : undefined}
              accessibilityLabel={
                selecting
                  ? `${formatSessionDate(item.startedAt)}, ${pluralize(item.totalCues, 'cue')}`
                  : `Select ${formatSessionDate(item.startedAt)}`
              }
              accessibilityHint={selecting ? undefined : 'Enters select mode for this session'}
            >
              <View style={[styles.cardShadow, selecting && isOn && styles.cardShadowSelected]}>
                <View style={[styles.card, selecting && isOn && styles.cardSelected]}>
                  <View style={styles.cardBody}>
                    {selecting ? <SelectMark selected={isOn} /> : null}
                    <View style={styles.cardMain}>
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
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          sessions === null ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No drills yet</Text>
              <Text style={styles.empty}>Finish a session on the Home tab and it'll show up here.</Text>
            </View>
          )
        }
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },

  cardShadow: { borderRadius: glassRadius.card, ...glow.card },
  cardShadowSelected: { shadowOpacity: 0.14 },
  card: {
    backgroundColor: glass.fill,
    borderRadius: glassRadius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardSelected: {
    backgroundColor: glass.fillStrong,
    borderColor: accents.data.solid,
  },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMain: { flex: 1, gap: spacing.sm },
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

  selectMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(24,20,37,0.18)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectMarkOn: {
    borderColor: accents.data.solid,
    backgroundColor: accents.data.solid,
  },

  empty: { ...glassType.body, textAlign: 'center', lineHeight: 22 },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.huge, paddingHorizontal: spacing.lg },
  emptyTitle: { ...glassType.title, color: light.inkSoft },
});
