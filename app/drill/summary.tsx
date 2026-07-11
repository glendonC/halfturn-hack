import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  GlassButton,
  GlassCard,
  GlassCueDistribution,
  GlassScreen,
  GlassStat,
  GradientSquircle,
  Icons,
} from '@/components/glass';
import { useDrillStore } from '@/state/useDrillStore';
import { accents, glassType, spacing } from '@/theme';
import { formatDuration } from '@/utils/format';

export default function SummaryScreen() {
  const router = useRouter();
  const result = useDrillStore((s) => s.result);
  // Set when we deliberately leave, so the redirect effect below doesn't race
  // the intentional navigation when reset() synchronously nulls `result`.
  const leaving = useRef(false);

  useEffect(() => {
    if (!result && !leaving.current) router.replace('/');
  }, [result, router]);

  if (!result) return null;

  const minutes = Math.max(result.actualDurationSec / 60, 1 / 60);
  const cuesPerMin = Math.round((result.totalCues / minutes) * 10) / 10;
  const left = result.cueCounts.check_left ?? 0;
  const right = result.cueCounts.check_right ?? 0;
  const directional = left + right;
  const leftPct = directional > 0 ? Math.round((left / directional) * 100) : 0;
  const accent = result.completed ? 'home' : 'field';

  const done = () => {
    leaving.current = true;
    useDrillStore.getState().reset();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const repeat = () => {
    leaving.current = true;
    useDrillStore.getState().reset();
    router.replace('/drill/active');
  };

  return (
    <GlassScreen scroll accent={accent}>
      <Text style={styles.kicker}>{result.completed ? 'Drill complete' : 'Drill stopped'}</Text>
      <Text style={styles.title}>{result.completed ? 'Nice work.' : 'Saved.'}</Text>

      <GradientSquircle accent={accent} style={styles.hero}>
        <View style={styles.heroPad}>
          <GlassStat size="md" value={formatDuration(result.actualDurationSec)} label="Trained" />
          <View style={styles.heroDivider} />
          <GlassStat size="md" value={String(result.totalCues)} label="Cues" />
          <View style={styles.heroDivider} />
          <GlassStat size="md" value={`${cuesPerMin}`} label="Cues / min" />
        </View>
      </GradientSquircle>

      <View style={styles.stack}>
        {directional > 0 ? (
          <GlassCard title="Left / right checks">
            <View style={styles.lr}>
              <GlassStat size="sm" value={String(left)} label={`Left · ${leftPct}%`} color={accents.field.solid} />
              <GlassStat size="sm" value={String(right)} label={`Right · ${100 - leftPct}%`} color={accents.vocab.solid} />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard title="Cue distribution">
          <GlassCueDistribution counts={result.cueCounts} total={result.totalCues} />
        </GlassCard>

        {result.verification ? (
          <GlassCard title="Scan verification" subtitle={result.verification.engine}>
            <View style={styles.verifyRow}>
              <GlassStat size="sm" value={String(result.verification.scansDetected)} label="Turns" color={accents.audio.solid} />
              <GlassStat size="sm" value={`${result.verification.scansPerMinute}`} label="Turns / min" color={accents.vocab.solid} />
              <GlassStat
                size="sm"
                value={result.verification.avgReactionMs != null ? `${result.verification.avgReactionMs}ms` : '—'}
                label="Avg reaction"
                color={accents.voice.solid}
              />
            </View>
            <View style={styles.lr}>
              <GlassStat size="sm" value={String(result.verification.leftScans)} label="Left turns" color={accents.field.solid} />
              <GlassStat size="sm" value={String(result.verification.rightScans)} label="Right turns" color={accents.vocab.solid} />
            </View>
            {result.verification.scannedBeforeActionRate != null ? (
              <Text style={styles.note}>
                Scanned before an action cue {Math.round(result.verification.scannedBeforeActionRate * 100)}% of the time.
              </Text>
            ) : null}
          </GlassCard>
        ) : (
          <Text style={styles.phaseNote}>
            {result.config.mode === 'turn-react'
              ? 'No scan data this run — camera verification needs the dev build.'
              : 'Turn & React verifies your actual shoulder checks, scan count, and reaction time.'}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <GlassButton label="Repeat" variant="secondary" size="lg" icon={Icons.Repeat} onPress={repeat} style={styles.flex} />
        <GlassButton label="Done" size="lg" icon={Icons.Check} onPress={done} style={styles.flex} />
      </View>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...glassType.overline, color: accents.home.solid, marginTop: spacing.lg },
  title: { ...glassType.hero, fontSize: 44, marginTop: spacing.xs, marginBottom: spacing.lg },
  hero: {},
  heroPad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(24,20,37,0.12)', marginVertical: 4 },
  stack: { gap: spacing.lg, marginTop: spacing.xl },
  lr: { flexDirection: 'row', gap: spacing.xl },
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  note: { ...glassType.caption, lineHeight: 18 },
  phaseNote: { ...glassType.caption, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  flex: { flex: 1 },
});
