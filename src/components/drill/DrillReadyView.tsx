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
import type { DrillConfig } from '@/types';
import {
  accents,
  glass,
  glassRadius,
  glassType,
  glow,
  hitSlop,
  light,
  spacing,
  type AccentKey,
} from '@/theme';
import { formatDuration, formatSeconds, pluralize } from '@/utils/format';

interface DrillReadyViewProps {
  config: DrillConfig;
  onStart: () => void;
  onTest: () => void;
  onBack: () => void;
}

/** Same chrome recipe as framing / GlassTabBar. */
const BAR = 52;

/**
 * Pre-drill "ready" screen: session summary, an audio-check control, and Start.
 * Presentational — all drill lifecycle lives in the engine; the active screen
 * wires the callbacks. Light glass shell to match Home / framing / summary.
 */
export function DrillReadyView({ config, onStart, onTest, onBack }: DrillReadyViewProps) {
  const insets = useSafeAreaInsets();
  const isTurnReact = config.mode === 'turn-react';
  const accent: AccentKey = isTurnReact ? 'home' : 'audio';
  const solid = accents[accent].solid;

  const [glassEpoch, setGlassEpoch] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGlassEpoch((n) => n + 1));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <GlassScreen accent={accent} edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.body}>
        <View style={styles.center}>
          <Text style={[styles.kicker, { color: solid }]}>
            {isTurnReact ? 'Turn & React' : 'Spoken cues'}
          </Text>
          <Text style={styles.duration}>{formatDuration(config.durationSec)}</Text>
          <Text style={styles.meta}>
            {pluralize(config.enabledCues.length, 'cue type')} · every{' '}
            {formatSeconds(config.intervalMinSec)}–{formatSeconds(config.intervalMaxSec)}
          </Text>

          <Pressable
            onPress={onTest}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Test sound"
            style={[styles.testShadow, glow.floating]}
          >
            <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.testPill}>
              <Icon icon={Icons.Volume2} size={18} color={light.ink} strokeWidth={2} />
              <Text style={styles.testLabel}>Test sound</Text>
            </GlassSurface>
          </Pressable>

          <Text style={styles.tip}>
            {isTurnReact
              ? 'Mount the phone, then start. Keep your back to the camera during the drill.'
              : 'Put your headphones in. On iPhone, turn the silent switch off so cues stay audible.'}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
        <GlassCluster key={glassEpoch} spacing={22} style={styles.actionRow}>
          <Pressable
            onPress={onBack}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.circleShadow}
          >
            <GlassSurface radius={BAR / 2} intensity="regular" fill={glass.fill} style={styles.circle}>
              <Icon icon={Icons.ChevronLeft} size={22} color={light.inkSoft} strokeWidth={1.9} />
            </GlassSurface>
          </Pressable>

          <ActionPill label="Start" icon={Icons.Play} onPress={onStart} />
        </GlassCluster>
      </View>
    </GlassScreen>
  );
}

function ActionPill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconComponent;
  onPress: () => void;
}) {
  return (
    <View style={[styles.pillShadow, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pillPress}
      >
        <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.pill}>
          <Icon icon={icon} size={18} color={light.ink} strokeWidth={2} />
          <Text style={styles.pillLabel}>{label}</Text>
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  kicker: { ...glassType.overline },
  duration: { ...glassType.hero, fontSize: 72, lineHeight: 78, color: light.ink },
  meta: { ...glassType.body, color: light.inkMuted, textAlign: 'center' },

  testShadow: { marginTop: spacing.xl, borderRadius: glassRadius.pill },
  testPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  testLabel: { ...glassType.label, fontSize: 15, color: light.ink, fontWeight: '600' },
  tip: {
    ...glassType.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },

  footer: {
    paddingHorizontal: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleShadow: { borderRadius: BAR / 2, ...glow.floating },
  circle: { width: BAR, height: BAR, alignItems: 'center', justifyContent: 'center' },

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
});
