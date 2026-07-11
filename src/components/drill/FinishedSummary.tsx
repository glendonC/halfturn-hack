import { StyleSheet, Text, View } from 'react-native';

import {
  GlassButton,
  GlassCard,
  GlassCueDistribution,
  GlassScreen,
  GlassStat,
  GradientSquircle,
  Icons,
  type CueCounts,
} from '@/components/glass';
import { useDrillStore } from '@/state';
import { accents, glassType, spacing } from '@/theme';
import { formatDuration } from '@/utils/format';

import { formatDurationMs } from './sessionStats';

export function FinishedSummary({
  onDone,
  onRepeat,
}: {
  onDone: () => void;
  onRepeat?: () => void;
}) {
  const cueEvents = useDrillStore((s) => s.cueEvents);
  const durationDrillMs = useDrillStore((s) => s.durationDrillMs);
  const cuesFired = useDrillStore((s) => s.cuesFired);
  const config = useDrillStore((s) => s.config);
  const persistStatus = useDrillStore((s) => s.persistStatus);
  const persistError = useDrillStore((s) => s.persistError);
  const lastVerification = useDrillStore((s) => s.lastVerification);

  const counts: CueCounts = {};
  for (const event of cueEvents) {
    counts[event.cueId] = (counts[event.cueId] ?? 0) + 1;
  }
  const left = counts.check_left ?? 0;
  const right = counts.check_right ?? 0;
  const directional = left + right;
  const leftPct = directional > 0 ? Math.round((left / directional) * 100) : 0;
  const durationSec = Math.max(0, Math.round(durationDrillMs / 1000));
  const minutes = Math.max(durationSec / 60, 1 / 60);
  const cuesPerMin = Math.round((cuesFired / minutes) * 10) / 10;
  const accent = persistStatus === 'saved' ? 'home' : 'field';

  const saveLabel =
    persistStatus === 'saving'
      ? 'Saving to this device…'
      : persistStatus === 'saved'
        ? 'Saved on this device — see History.'
        : persistStatus === 'error'
          ? `Save issue: ${persistError ?? 'unknown'}`
          : 'Session finished.';

  return (
    <GlassScreen scroll accent={accent}>
      <Text style={styles.kicker}>
        {config.mode === 'audio' ? 'Audio drill' : 'Turn & React'}
      </Text>
      <Text style={styles.title}>Nice work.</Text>
      <Text style={styles.subtitle}>{saveLabel}</Text>

      <GradientSquircle accent={accent} style={styles.hero}>
        <View style={styles.heroPad}>
          <GlassStat
            size="md"
            value={formatDuration(durationSec)}
            label="Trained"
          />
          <View style={styles.heroDivider} />
          <GlassStat size="md" value={String(cuesFired)} label="Cues" />
          <View style={styles.heroDivider} />
          <GlassStat size="md" value={`${cuesPerMin}`} label="Cues / min" />
        </View>
      </GradientSquircle>

      <View style={styles.stack}>
        {directional > 0 ? (
          <GlassCard title="Left / right checks">
            <View style={styles.lr}>
              <GlassStat
                size="sm"
                value={String(left)}
                label={`Left · ${leftPct}%`}
                color={accents.field.solid}
              />
              <GlassStat
                size="sm"
                value={String(right)}
                label={`Right · ${100 - leftPct}%`}
                color={accents.vocab.solid}
              />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard title="Cue distribution">
          <GlassCueDistribution counts={counts} total={cuesFired} />
        </GlassCard>

        {lastVerification ? (
          <GlassCard
            title="Scan verification"
            subtitle={lastVerification.engine}
          >
            <View style={styles.verifyRow}>
              <GlassStat
                size="sm"
                value={String(lastVerification.scansDetected)}
                label="Turns"
                color={accents.audio.solid}
              />
              <GlassStat
                size="sm"
                value={`${lastVerification.scansPerMinute}`}
                label="Turns / min"
                color={accents.vocab.solid}
              />
              <GlassStat
                size="sm"
                value={
                  lastVerification.avgReactionMs != null
                    ? `${lastVerification.avgReactionMs}ms`
                    : '—'
                }
                label="Avg reaction"
                color={accents.voice.solid}
              />
            </View>
          </GlassCard>
        ) : (
          <Text style={styles.phaseNote}>
            {config.mode === 'turn-react'
              ? 'No scan data this run — camera verification needs the custom client.'
              : 'Turn & React verifies shoulder checks, scan count, and reaction time.'}
          </Text>
        )}

        {cueEvents.length > 0 ? (
          <GlassCard title="Cue timeline">
            {cueEvents.map((cue) => (
              <View key={cue.seq} style={styles.timelineRow}>
                <Text style={styles.timelineIndex}>#{cue.seq + 1}</Text>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelinePhrase}>{cue.phrase}</Text>
                  <Text style={styles.timelineMeta}>{cue.cueId}</Text>
                </View>
                <Text style={styles.timelineTime}>
                  {(cue.firedAtMonoMs / 1000).toFixed(1)}s
                </Text>
              </View>
            ))}
          </GlassCard>
        ) : null}
      </View>

      <View style={styles.actions}>
        {onRepeat ? (
          <GlassButton
            label="Repeat"
            variant="secondary"
            size="lg"
            icon={Icons.Repeat}
            onPress={onRepeat}
            style={styles.flex}
          />
        ) : null}
        <GlassButton
          label="Done"
          size="lg"
          icon={Icons.Check}
          onPress={onDone}
          style={styles.flex}
        />
      </View>

      <Text style={styles.durationHint}>{formatDurationMs(durationDrillMs)}</Text>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...glassType.overline, color: accents.home.solid, marginTop: spacing.lg },
  title: { ...glassType.hero, fontSize: 44, marginTop: spacing.xs },
  subtitle: { ...glassType.body, marginBottom: spacing.lg },
  hero: {},
  heroPad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(24,20,37,0.12)',
    marginVertical: 4,
  },
  stack: { gap: spacing.lg, marginTop: spacing.xl },
  lr: { flexDirection: 'row', gap: spacing.xl },
  verifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  phaseNote: { ...glassType.caption, lineHeight: 18 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  timelineIndex: { ...glassType.caption, width: 36 },
  timelineBody: { flex: 1 },
  timelinePhrase: { ...glassType.label, color: accents.home.solid },
  timelineMeta: { ...glassType.caption },
  timelineTime: { ...glassType.caption },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  flex: { flex: 1 },
  durationHint: { ...glassType.caption, textAlign: 'center', marginTop: spacing.md },
});
