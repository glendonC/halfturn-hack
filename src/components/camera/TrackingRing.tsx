import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { trackingLevel, type TrackingLevel } from '@/constants/visionTuning';
import { colors } from '@/theme';

/**
 * Confidence → theme color for tracking health. Shared by the in-drill squircle
 * ring and the framing pill so the two never drift. `none` (no signal yet) is a
 * muted gray, not an alarming red, so the UI doesn't flash before the pipeline
 * has produced a frame. See constants/visionTuning `trackingLevel`.
 */
const LEVEL_COLOR: Record<TrackingLevel, string> = {
  none: colors.borderStrong,
  poor: colors.danger,
  ok: colors.warning,
  good: colors.success,
};

/** Map a tracking confidence (0..1) to its health color. */
export function trackingLevelColor(confidence: number): string {
  return LEVEL_COLOR[trackingLevel(confidence)];
}

interface TrackingRingProps {
  /** Tracking confidence, 0..1 (min shoulder visibility). */
  confidence: number;
  /** Match the parent's corner radius so the ring hugs the squircle. */
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A non-interactive colored border that overlays the camera squircle, signaling
 * live tracking health (green solid / yellow ok / red weak / gray no-signal).
 */
export function TrackingRing({ confidence, borderRadius, style }: TrackingRingProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.ring,
        { borderRadius, borderColor: trackingLevelColor(confidence) },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2.5 },
});
