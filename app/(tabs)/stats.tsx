import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassCard,
  GlassCueDistribution,
  GlassPageHeader,
  GlassScreen,
  Sparkline,
} from '@/components/glass';
import { getHistoryStats, listSessions, type HistoryStats } from '@/services/db';
import { accents, colors, glassRadius, glassType, light, spacing, type AccentKey } from '@/theme';
import type { DrillSessionSummary } from '@/types';
import { formatDuration } from '@/utils/format';
import { aggregateCueCounts, leftRightSplit, weeklySessionCounts } from '@/utils/stats';

/** Space the floating nav reserves at the bottom. */
const NAV_CLEARANCE = 96;
/** Weeks of history shown in the hero trend line. */
const TREND_WEEKS = 8;

function MetricCell({ value, label, accent }: { value: string; label: string; accent: AccentKey }) {
  return (
    <View style={styles.metricCell}>
      <View style={[styles.metricKey, { backgroundColor: accents[accent].solid }]} />
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<DrillSessionSummary[] | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([listSessions(), getHistoryStats()]);
      setSessions(list);
      setStats(st);
    } catch (err) {
      console.warn('[stats] load failed', err);
      setSessions([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const derived = useMemo(() => {
    const list = sessions ?? [];
    const weekly = weeklySessionCounts(list, TREND_WEEKS);
    const cueMix = aggregateCueCounts(list);
    const mixTotal = Object.values(cueMix).reduce<number>((a, b) => a + (b ?? 0), 0);
    const balance = leftRightSplit(cueMix);
    const completed = list.filter((s) => s.completed).length;
    return { weekly, cueMix, mixTotal, balance, completed };
  }, [sessions]);

  const totalSessions = stats?.totalSessions ?? 0;
  const avgSessionSec = totalSessions > 0 ? (stats?.totalDurationSec ?? 0) / totalSessions : 0;
  const completionPct = (sessions?.length ?? 0) > 0 ? Math.round((derived.completed / sessions!.length) * 100) : 0;
  const thisWeek = stats?.sessionsThisWeek ?? 0;
  const balanceTotal = derived.balance.left + derived.balance.right;

  const loading = sessions === null || stats === null;
  const empty = !loading && totalSessions === 0;

  return (
    <GlassScreen scroll scrollUnderTop transitionOnFocus accent="home" contentStyle={{ paddingBottom: insets.bottom + NAV_CLEARANCE }}>
      <GlassPageHeader title="Stats" />

      {empty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.empty}>Finish a session on the Home tab and your totals and trend will build up here.</Text>
        </View>
      ) : (
        <>
          <View style={styles.trendPanel}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={styles.panelLabel}>SESSIONS</Text>
                <Text style={styles.heroNumber}>{totalSessions}</Text>
              </View>
              <View style={styles.weekReadout}>
                <Text style={styles.weekValue}>{thisWeek}</Text>
                <Text style={styles.weekLabel}>THIS WEEK</Text>
              </View>
            </View>
            <Sparkline data={derived.weekly} color={accents.home.solid} height={72} strokeWidth={2.5} />
            <Text style={styles.trendCaption}>Weekly sessions over the last {TREND_WEEKS} weeks</Text>
          </View>

          <View style={styles.metricsPanel}>
            <View style={styles.metricsRow}>
              <MetricCell value={formatDuration(stats?.totalDurationSec ?? 0)} label="TOTAL TIME" accent="field" />
              <View style={styles.verticalDivider} />
              <MetricCell value={String(stats?.totalCues ?? 0)} label="CUES FIRED" accent="vocab" />
            </View>
            <View style={styles.horizontalDivider} />
            <View style={styles.metricsRow}>
              <MetricCell value={formatDuration(avgSessionSec)} label="AVG SESSION" accent="voice" />
              <View style={styles.verticalDivider} />
              <MetricCell value={`${completionPct}%`} label="COMPLETED" accent="feedback" />
            </View>
          </View>

          {/* Left / right shoulder-check balance. */}
          <GlassCard title="Left / right balance" style={styles.card}>
            {balanceTotal > 0 ? (
              <>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceEnd}>L {derived.balance.left}</Text>
                  <View style={styles.balanceTrack}>
                    <View style={{ flex: derived.balance.left || 0.0001, backgroundColor: colors.cueLeft }} />
                    <View style={{ flex: derived.balance.right || 0.0001, backgroundColor: colors.cueRight }} />
                  </View>
                  <Text style={styles.balanceEnd}>{derived.balance.right} R</Text>
                </View>
                <View style={styles.balanceSummary}>
                  <Text style={styles.note}>{Math.round((derived.balance.left / balanceTotal) * 100)}% left</Text>
                  <Text style={styles.note}>{Math.round((derived.balance.right / balanceTotal) * 100)}% right</Text>
                </View>
              </>
            ) : (
              <Text style={styles.note}>No shoulder-check cues fired yet. Add Check Left / Check Right on Home.</Text>
            )}
          </GlassCard>

          {/* Aggregate cue mix across every session. */}
          <GlassCard title="Cue mix" style={styles.card}>
            <GlassCueDistribution counts={derived.cueMix} total={derived.mixTotal} />
          </GlassCard>
        </>
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  trendPanel: {
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: light.hairline,
    borderRadius: 8,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  trendHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  panelLabel: { ...glassType.overline, color: light.inkMuted, letterSpacing: 0 },
  heroNumber: { fontSize: 42, lineHeight: 47, fontWeight: '300', color: light.ink, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  weekReadout: { alignItems: 'flex-end' },
  weekValue: { fontSize: 22, lineHeight: 27, fontWeight: '600', color: accents.home.solid, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  weekLabel: { ...glassType.overline, color: light.inkFaint, letterSpacing: 0 },
  trendCaption: { ...glassType.caption, color: light.inkFaint },

  metricsPanel: { marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.56)', borderWidth: StyleSheet.hairlineWidth, borderColor: light.hairline, borderRadius: 8, padding: spacing.lg },
  metricsRow: { flexDirection: 'row', minHeight: 72 },
  metricCell: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: spacing.sm },
  metricKey: { width: 18, height: 3, borderRadius: 2, marginBottom: spacing.sm },
  metricValue: { fontSize: 23, lineHeight: 28, fontWeight: '500', color: light.ink, fontVariant: ['tabular-nums'], letterSpacing: 0 },
  metricLabel: { fontSize: 9, lineHeight: 12, fontWeight: '700', color: light.inkFaint, letterSpacing: 0, marginTop: 2 },
  verticalDivider: { width: StyleSheet.hairlineWidth, backgroundColor: light.hairline },
  horizontalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: light.hairline },

  card: { marginTop: spacing.md },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceEnd: { ...glassType.label, color: light.inkSoft, width: 44 },
  balanceTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 12,
    borderRadius: glassRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(24,20,37,0.06)',
  },
  balanceSummary: { flexDirection: 'row', justifyContent: 'space-between' },
  note: { ...glassType.caption, color: 'rgba(24,20,37,0.55)', lineHeight: 16 },

  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.huge, paddingHorizontal: spacing.lg },
  emptyTitle: { ...glassType.title, color: light.inkSoft },
  empty: { ...glassType.body, textAlign: 'center', lineHeight: 22 },
});
