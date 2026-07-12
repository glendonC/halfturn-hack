import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  readDiagnostics,
  usePoseModelStore,
  VISION_ENABLED,
  type VisionDiagnostics as Diag,
} from '@/services/vision';
import { colors, typography } from '@/theme';

/** Poll cadence — slow on purpose so the overlay re-renders at ~2fps, not 15. */
const POLL_MS = 500;
const ENABLED = __DEV__ && VISION_ENABLED;

interface VisionDiagnosticsProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Dev-only pipeline HUD (effective fps · mean confidence · frame count · mean
 * inference) for on-field tuning. Renders nothing unless `__DEV__ && VISION_ENABLED`,
 * so it's absent in production and in Expo Go. It POLLS the diagnostics ring on a
 * slow timer rather than subscribing per-frame, keeping it off the hot path.
 */
export function VisionDiagnostics({ style }: VisionDiagnosticsProps) {
  const [diag, setDiag] = useState<Diag | null>(null);
  // Which pose variant these numbers came from. During an A/B session the fps/confidence read
  // IS the measurement, so an unlabeled HUD is how you end up attributing one arm's numbers to
  // the other.
  const model = usePoseModelStore((s) => s.modelId);

  useEffect(() => {
    if (!ENABLED) return;
    const id = setInterval(() => setDiag(readDiagnostics()), POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (!ENABLED || !diag) return null;

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Text style={styles.text}>
        {model} · {diag.effectiveFps.toFixed(0)} fps · conf {diag.meanConfidence.toFixed(2)} ·{' '}
        {diag.frameCount} fr · {diag.meanInferenceMs}ms
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(7,10,14,0.72)',
  },
  text: { ...typography.caption, color: colors.primary, fontVariant: ['tabular-nums'] },
});
