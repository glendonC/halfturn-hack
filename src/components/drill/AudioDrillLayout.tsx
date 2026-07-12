import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassCluster,
  GlassScreen,
  GlassSurface,
  Icon,
  Icons,
  type IconComponent,
} from '@/components/glass';
import {
  accents,
  glass,
  glassRadius,
  glassType,
  glow,
  hitSlop,
  light,
  spacing,
} from '@/theme';
import { formatClock } from '@/utils/format';
import { CueDisplay } from './CueDisplay';
import type { DrillLayoutProps } from './layoutProps';
import { PausedOverlay } from './PausedOverlay';

/** Same chrome height as framing / nav. */
const BAR = 52;

/**
 * Spoken-cues training session — same light glass language as Ready / Home /
 * framing: bloom shell, hero clock, frosted cue squircle, clustered transport.
 */
export function AudioDrillLayout({ engine, durationMs, cueCount }: DrillLayoutProps) {
  const insets = useSafeAreaInsets();
  const paused = engine.status === 'paused';
  const progress = durationMs > 0 ? Math.min(1, engine.elapsedMs / durationMs) : 0;

  // Liquid Glass can stick dark on first paint under a stack navigator.
  const [glassEpoch, setGlassEpoch] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGlassEpoch((n) => n + 1));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <GlassScreen accent="audio" edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.body}>
        <Text style={styles.kicker}>Spoken cues</Text>
        <Text style={styles.time}>{formatClock(engine.remainingMs / 1000)}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{cueCount} cues</Text>
          <Text style={styles.meta}>{formatClock(engine.elapsedMs / 1000)} in</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={[styles.hudShadow, glow.card]}>
          <GlassSurface
            key={`hud-${glassEpoch}`}
            radius={glassRadius.squircle}
            intensity="regular"
            fill={glass.fill}
            style={styles.hud}
          >
            <CueDisplay currentCue={engine.currentCue} waiting />
            {paused ? <PausedOverlay /> : null}
          </GlassSurface>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
        <GlassCluster key={glassEpoch} spacing={22} style={styles.actionRow}>
          <TransportPill
            label={paused ? 'Resume' : 'Pause'}
            icon={paused ? Icons.Play : Icons.Pause}
            onPress={paused ? engine.resume : engine.pause}
            flex={1.35}
          />
          <TransportPill label="Stop" icon={Icons.X} onPress={engine.stop} flex={1} danger />
        </GlassCluster>
      </View>
    </GlassScreen>
  );
}

function TransportPill({
  label,
  icon,
  onPress,
  flex = 1,
  danger = false,
}: {
  label: string;
  icon: IconComponent;
  onPress: () => void;
  flex?: number;
  danger?: boolean;
}) {
  return (
    <View style={[styles.pillShadow, { flex }]}>
      <Pressable
        onPress={onPress}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pillPress}
      >
        <GlassSurface
          radius={glassRadius.pill}
          intensity="regular"
          fill={glass.fill}
          tintColor={danger ? accents.data.wash : undefined}
          style={styles.pill}
        >
          <Icon icon={icon} size={18} color={danger ? accents.data.solid : light.ink} strokeWidth={2} />
          <Text style={[styles.pillLabel, danger && styles.pillLabelDanger]}>{label}</Text>
        </GlassSurface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  kicker: { ...glassType.overline, color: accents.audio.solid, textAlign: 'center' },
  time: {
    ...glassType.hero,
    fontSize: 72,
    lineHeight: 78,
    color: light.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  meta: { ...glassType.caption, color: light.inkMuted, fontWeight: '600' },
  track: {
    height: 5,
    borderRadius: glassRadius.pill,
    backgroundColor: 'rgba(24,20,37,0.08)',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  fill: { height: '100%', backgroundColor: accents.audio.solid, borderRadius: glassRadius.pill },

  hudShadow: { flex: 1, borderRadius: glassRadius.squircle, marginTop: spacing.sm },
  hud: { flex: 1 },

  footer: { paddingHorizontal: spacing.lg },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillShadow: { borderRadius: glassRadius.pill, ...glow.floating },
  pillPress: { width: '100%' },
  pill: {
    height: BAR,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pillLabel: { ...glassType.label, fontSize: 15, color: light.ink, fontWeight: '600' },
  pillLabelDanger: { color: accents.data.solid },
});
