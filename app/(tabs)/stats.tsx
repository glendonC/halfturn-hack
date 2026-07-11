import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassCard,
  GlassCueDistribution,
  GlassScreen,
  GlassStat,
  GradientSquircle,
  Icon,
  Icons,
  Sparkline,
  type IconComponent,
} from '@/components/glass';
import {
  getHistoryStats,
  listSessions,
  type HistoryStats,
  type StoredSessionSummary,
} from '@/services/db';
import { accents, colors, glassRadius, glassType, glow, light, spacing, type AccentKey } from '@/theme';
import { formatDuration, pluralize } from '@/utils/format';
import { aggregateCueCounts, leftRightSplit, weeklySessionCounts } from '@/utils/stats';

/** Space the floating nav reserves at the bottom. */
const NAV_CLEARANCE = 96;
/** Weeks of history shown in the hero trend line. */
const TREND_WEEKS = 8;

/** One frosted bento tile: an accent icon chip over a big stat. */
function StatTile({ icon, value, label, accent }: { icon: IconComponent; value: string; label: string; accent: AccentKey }) {
  return (
    <View style={styles.tileShadow}>
      <View style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: accents[accent].wash }]}>
          <Icon icon={icon} size={16} color={accents[accent].solid} strokeWidth={2} />
        </View>
        <GlassStat size="md" value={value} label={label} accent={accent} />
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<StoredSessionSummary[] | null>(null);
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
    <GlassScreen scroll accent="home" contentStyle={{ paddingBottom: insets.bottom + NAV_CLEARANCE }}>
      <Text style={styles.overline}>Your progress</Text>
      <Text style={styles.title}>Stats</Text>

      {empty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.empty}>Finish a session on the Home tab and your totals and trend will build up here.</Text>
        </View>
      ) : (
        <>
          {/* Signature hero: the headline count + its weekly trend. */}
          <GradientSquircle accent="home" style={styles.hero}>
            <View style={styles.heroPad}>
              <View style={styles.heroTop}>
                <View style={styles.heroFigure}>
                  <Text style={styles.heroLabel}>Sessions</Text>
                  <Text style={styles.heroNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                    {totalSessions}
                  </Text>
                </View>
                <View style={styles.sparkWrap}>
                  <Sparkline data={derived.weekly} color={accents.home.solid} height={56} />
                  <Text style={styles.sparkCaption}>Last {TREND_WEEKS} weeks</Text>
                </View>
              </View>
              <Text style={styles.heroNote}>
                {thisWeek > 0 ? `${pluralize(thisWeek, 'session')} this week — keep it up.` : 'No sessions yet this week.'}
              </Text>
            </View>
          </GradientSquircle>

          {/* Bento of aggregate totals. */}
          <View style={styles.grid}>
            <StatTile icon={Icons.Timer} value={formatDuration(stats?.totalDurationSec ?? 0)} label="Total time" accent="field" />
            <StatTile icon={Icons.MessageSquareText} value={String(stats?.totalCues ?? 0)} label="Cues fired" accent="vocab" />
            <StatTile icon={Icons.Repeat} value={formatDuration(avgSessionSec)} label="Avg session" accent="voice" />
            <StatTile icon={Icons.Trophy} value={`${completionPct}%`} label="Completed" accent="feedback" />
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
                <Text style={styles.note}>
                  {Math.round((derived.balance.left / balanceTotal) * 100)}% left ·{' '}
                  {Math.round((derived.balance.right / balanceTotal) * 100)}% right
                </Text>
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
  overline: { ...glassType.overline, marginTop: spacing.lg, color: accents.home.solid },
  title: { ...glassType.hero, fontSize: 44, marginTop: spacing.xs, marginBottom: spacing.lg },

  hero: { marginBottom: spacing.md },
  heroPad: { padding: spacing.xl, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  heroFigure: { justifyContent: 'flex-end' },
  heroLabel: { ...glassType.overline, color: 'rgba(24,20,37,0.55)' },
  heroNumber: { ...glassType.hero, fontSize: 60, lineHeight: 64, color: light.ink },
  sparkWrap: { flex: 1, gap: 4 },
  sparkCaption: { ...glassType.caption, color: 'rgba(24,20,37,0.5)', textAlign: 'right' },
  heroNote: { ...glassType.caption, color: 'rgba(24,20,37,0.6)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileShadow: { flexBasis: '47%', flexGrow: 1, borderRadius: glassRadius.card, ...glow.card },
  tile: {
    borderRadius: glassRadius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

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
  note: { ...glassType.caption, color: 'rgba(24,20,37,0.55)', lineHeight: 16 },

  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.huge, paddingHorizontal: spacing.lg },
  emptyTitle: { ...glassType.title, color: light.inkSoft },
  empty: { ...glassType.body, textAlign: 'center', lineHeight: 22 },
});
