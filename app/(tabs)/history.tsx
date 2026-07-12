import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassActionPill, GlassScreen, Icon, Icons, ScrollEdgeFades } from '@/components/glass';
import { deleteSessions, getHistoryStats, listSessions, type HistoryStats } from '@/services/db';
import { accents, animateNext, glassType, light, spacing } from '@/theme';
import type { DrillSessionSummary } from '@/types';
import { formatDuration, formatSessionDate, pluralize } from '@/utils/format';
import { weeklySessionCounts } from '@/utils/stats';

const NAV_CLEARANCE = 96;
const TREND_WEEKS = 8;

function ActivityBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.chart} accessibilityLabel={`Sessions over the last ${TREND_WEEKS} weeks: ${values.join(', ')}`}>
      {values.map((value, index) => {
        const height = value === 0 ? 3 : Math.max(12, Math.round((value / max) * 76));
        const current = index === values.length - 1;
        return (
          <View key={index} style={styles.barColumn}>
            <Text style={[styles.barValue, value === 0 && styles.barValueMuted]}>{value > 0 ? value : ''}</Text>
            <View style={[styles.bar, { height }, current && styles.barCurrent]} />
            <Text style={[styles.barLabel, current && styles.barLabelCurrent]}>{current ? 'NOW' : `W${index + 1}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectMark, selected && styles.selectMarkOn]}>
      {selected ? <Icon icon={Icons.Check} size={13} color={light.white} strokeWidth={3} /> : null}
    </View>
  );
}

function SessionRow({
  session,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  session: DrillSessionSummary;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const mode = session.config.mode === 'turn-react' ? 'Turn & React' : 'Audio cues';
  const then = new Date(session.startedAt);
  const today = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(today) - startOfDay(then)) / (24 * 60 * 60 * 1000));
  const day = dayDiff === 0
    ? 'Today'
    : dayDiff === 1
      ? 'Yesterday'
      : then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <Pressable
      onPress={selecting ? onPress : undefined}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole={selecting ? 'checkbox' : undefined}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={`${formatSessionDate(session.startedAt)}, ${mode}, ${pluralize(session.totalCues, 'cue')}`}
      style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
    >
      <View style={[styles.sessionRow, selected && styles.sessionRowSelected]}>
        {selecting ? <SelectMark selected={selected} /> : null}
        <Text style={styles.dayCell} numberOfLines={1}>{day}</Text>
        <Text style={styles.timeCell} numberOfLines={1}>{time}</Text>
        <Text style={[styles.modeCell, !session.completed && styles.stoppedMode]} numberOfLines={1}>
          {session.completed ? mode : `${mode} (stopped)`}
        </Text>
        <Text style={styles.durationCell} numberOfLines={1}>{formatDuration(session.actualDurationSec)}</Text>
        <Text style={styles.cuesCell} numberOfLines={1}>{session.totalCues}</Text>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<DrillSessionSummary[] | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const load = useCallback(async () => {
    try {
      const [list, summary] = await Promise.all([listSessions(), getHistoryStats()]);
      setSessions(list);
      setStats(summary);
    } catch (err) {
      console.warn('[history] load failed', err);
      setSessions([]);
      setStats({ totalSessions: 0, totalCues: 0, totalDurationSec: 0, sessionsThisWeek: 0 });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    setSelecting(false);
    setSelected(new Set());
  }, [load]));

  const weekly = useMemo(() => weeklySessionCounts(sessions ?? [], TREND_WEEKS), [sessions]);
  const allIds = useMemo(() => (sessions ?? []).map((session) => session.id), [sessions]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;

  const enterSelect = (id?: string) => {
    animateNext();
    setSelecting(true);
    setSelected(id ? new Set([id]) : new Set());
  };
  const exitSelect = () => {
    animateNext();
    setSelecting(false);
    setSelected(new Set());
  };
  const toggleOne = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const confirmDelete = () => {
    if (selected.size === 0) return;
    const count = selected.size;
    Alert.alert(`Delete ${pluralize(count, 'session')}?`, 'This permanently removes the selected training history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSessions(Array.from(selected));
        exitSelect();
        await load();
      } },
    ]);
  };

  const headerActions = (sessions?.length ?? 0) > 0 ? selecting ? (
    <View style={styles.headerActions}>
      <GlassActionPill label={allSelected ? 'None' : 'All'} onPress={toggleAll} />
      <GlassActionPill label="Delete" icon={Icons.Trash2} danger disabled={selected.size === 0} onPress={confirmDelete} />
      <GlassActionPill label="Done" onPress={exitSelect} active accent="home" />
    </View>
  ) : <GlassActionPill label="Select" onPress={() => enterSelect()} accent="home" /> : null;

  return (
    <GlassScreen scrollUnderTop transitionOnFocus padded={false} accent="home">
      <View style={styles.flex}>
        <FlatList
          data={sessions ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + NAV_CLEARANCE },
          ]}
          showsVerticalScrollIndicator={false}
          extraData={{ selecting, selected: selected.size }}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => setScrollY(Math.max(0, event.nativeEvent.contentOffset.y))}
          scrollEventThrottle={16}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>History</Text>
              </View>
              {headerActions}
            </View>
            {(sessions?.length ?? 0) > 0 ? (
              <View style={styles.overview}>
                <View style={styles.overviewHeading}>
                  <View>
                    <Text style={styles.panelLabel}>ACTIVITY</Text>
                    <Text style={styles.panelTitle}>Last {TREND_WEEKS} weeks</Text>
                  </View>
                  <Text style={styles.weekFigure}>{pluralize(stats?.sessionsThisWeek ?? 0, 'session')} this week</Text>
                </View>
                <ActivityBars values={weekly} />
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}><Text style={styles.summaryValue}>{stats?.totalSessions ?? 0}</Text><Text style={styles.summaryLabel}>SESSIONS</Text></View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}><Text style={styles.summaryValue}>{formatDuration(stats?.totalDurationSec ?? 0)}</Text><Text style={styles.summaryLabel}>TRAINING</Text></View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}><Text style={styles.summaryValue}>{stats?.totalCues ?? 0}</Text><Text style={styles.summaryLabel}>CUES</Text></View>
                </View>
              </View>
            ) : null}
            {(sessions?.length ?? 0) > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
                <View style={styles.tableHeader}>
                  <Text style={styles.dayHeader}>DATE</Text>
                  <Text style={styles.timeHeader}>TIME</Text>
                  <Text style={styles.modeHeader}>SESSION</Text>
                  <Text style={styles.durationHeader}>LENGTH</Text>
                  <Text style={styles.cuesHeader}>CUES</Text>
                </View>
              </View>
            ) : null}
          </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
          <SessionRow
            session={item}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPress={() => toggleOne(item.id)}
            onLongPress={() => { if (!selecting) enterSelect(item.id); }}
          />
          )}
          ListEmptyComponent={sessions === null ? (
          <Text style={styles.loading}>Loading history…</Text>
        ) : (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}><Icon icon={Icons.CalendarDays} size={22} color={accents.home.solid} /></View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Your completed training sessions will appear here.</Text>
          </View>
          )}
        />
        <ScrollEdgeFades
          top={scrollY > 4}
          bottom={contentHeight > viewportHeight && scrollY + viewportHeight < contentHeight - 4}
          topInset={insets.top}
        />
      </View>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg },
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  titleBlock: { flex: 1 },
  title: { ...glassType.hero, color: light.ink, fontSize: 36, lineHeight: 42, fontWeight: '300', letterSpacing: 0 },
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 0 },

  overview: { backgroundColor: 'rgba(255,255,255,0.64)', borderWidth: StyleSheet.hairlineWidth, borderColor: light.hairline, borderRadius: 8, padding: spacing.lg, gap: spacing.lg, overflow: 'hidden' },
  overviewHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  panelLabel: { ...glassType.overline, color: light.inkFaint, letterSpacing: 0 },
  panelTitle: { ...glassType.subtitle, color: light.ink, fontSize: 17, marginTop: 3 },
  weekFigure: { ...glassType.caption, color: light.inkMuted },
  chart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 },
  barValue: { ...glassType.caption, color: light.inkMuted, fontVariant: ['tabular-nums'] },
  barValueMuted: { color: light.inkFaint },
  bar: { width: '100%', maxWidth: 34, minHeight: 3, backgroundColor: 'rgba(24,20,37,0.22)', borderRadius: 2 },
  barCurrent: { backgroundColor: light.ink },
  barLabel: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  barLabelCurrent: { color: light.ink },
  summaryRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: light.hairline, paddingTop: spacing.md },
  summaryItem: { flex: 1, gap: 2 },
  summaryValue: { color: light.ink, fontSize: 18, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: 0 },
  summaryLabel: { fontSize: 9, lineHeight: 12, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: light.hairline, marginHorizontal: spacing.md },
  sectionLabel: { ...glassType.overline, color: light.inkMuted, letterSpacing: 0, marginTop: spacing.sm },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: spacing.md, paddingBottom: spacing.xs, paddingHorizontal: spacing.sm },
  dayHeader: { width: 66, fontSize: 8, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  timeHeader: { width: 64, fontSize: 8, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  modeHeader: { flex: 1, fontSize: 8, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  durationHeader: { width: 46, textAlign: 'right', fontSize: 8, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },
  cuesHeader: { width: 30, textAlign: 'right', fontSize: 8, fontWeight: '700', color: light.inkFaint, letterSpacing: 0 },

  rowPressable: { marginHorizontal: -spacing.sm },
  rowPressed: { opacity: 0.72 },
  sessionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 8 },
  sessionRowSelected: { backgroundColor: 'rgba(24,20,37,0.05)' },
  dayCell: { width: 66, fontSize: 12, lineHeight: 16, fontWeight: '600', color: light.ink, letterSpacing: 0 },
  timeCell: { width: 64, fontSize: 11, lineHeight: 16, color: light.inkMuted, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  modeCell: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: light.inkSoft, letterSpacing: 0 },
  stoppedMode: { color: light.inkFaint },
  durationCell: { width: 46, textAlign: 'right', fontSize: 11, lineHeight: 16, fontWeight: '600', color: light.ink, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  cuesCell: { width: 30, textAlign: 'right', fontSize: 11, lineHeight: 16, color: light.inkMuted, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: light.hairline },
  selectMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(24,20,37,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  selectMarkOn: { borderColor: accents.home.solid, backgroundColor: accents.home.solid },

  loading: { ...glassType.body, textAlign: 'center', color: light.inkMuted, paddingTop: spacing.huge },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.huge, gap: spacing.sm, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: accents.home.wash, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { ...glassType.subtitle, color: light.ink },
  emptyText: { ...glassType.body, color: light.inkMuted, textAlign: 'center', lineHeight: 21 },
});
