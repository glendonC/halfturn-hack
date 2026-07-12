import { StyleSheet, Text, View } from 'react-native';

import { GlassScreen } from '@/components/glass';
import { accents, glassType, light, type AccentKey } from '@/theme';
import type { DrillMode } from '@/types';

interface DrillCountdownViewProps {
  /** 3 / 2 / 1 then 0 (rendered as "GO"); null shows nothing. */
  value: number | null;
  /** Tints the glass bloom toward the drill mode. */
  mode?: DrillMode;
}

/** The 3-2-1-GO pre-roll shown while the engine warms audio + verifier. */
export function DrillCountdownView({ value, mode = 'audio' }: DrillCountdownViewProps) {
  const text = value === 0 ? 'GO' : value != null ? String(value) : '';
  const accent: AccentKey = mode === 'turn-react' ? 'home' : 'audio';

  return (
    <GlassScreen accent={accent} edges={['top', 'left', 'right', 'bottom']} padded={false}>
      <View style={styles.center}>
        <Text style={[styles.kicker, { color: accents[accent].solid }]}>Get ready</Text>
        <Text style={styles.number}>{text}</Text>
      </View>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kicker: { ...glassType.overline },
  number: {
    ...glassType.hero,
    fontSize: 140,
    lineHeight: 150,
    fontWeight: '200',
    letterSpacing: -4,
    color: light.ink,
  },
});
