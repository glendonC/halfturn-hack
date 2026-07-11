import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LazyCameraVerifier, VISION_ENABLED } from '@/services/vision';
import { colors, typography } from '@/theme';
import { TrackingRing } from './TrackingRing';

/** Smart-mirror self-view dimensions (FaceTime-style PiP). */
export const SQUIRCLE_WIDTH = 116;
export const SQUIRCLE_HEIGHT = 156;
const SQUIRCLE_RADIUS = 28;

interface CameraSquircleProps {
  /** Positioning from the layout (e.g. absolute bottom-right). */
  style?: StyleProp<ViewStyle>;
  /** Draw the live tracking-confidence ring (default true). */
  showTrackingRing?: boolean;
}

/**
 * The bottom-right self-view "squircle" for the Turn & React FaceTime layout.
 *
 * It OWNS its own tracking-confidence state so the ~15fps `onTracking` updates
 * re-render only this small overlay — never the cue surface behind it. The
 * layout positions it; this component owns size, shape, the live camera, and the
 * tracking ring. In Expo Go (no dev build) it renders a quiet placeholder
 * instead of an empty box, since the camera can't run there.
 */
export function CameraSquircle({ style, showTrackingRing = true }: CameraSquircleProps) {
  const [confidence, setConfidence] = useState(0);

  if (!VISION_ENABLED) {
    return (
      <View style={[styles.squircle, styles.placeholder, style]} pointerEvents="none">
        <Text style={styles.placeholderText}>Self-view</Text>
        <Text style={styles.placeholderSub}>dev build only</Text>
      </View>
    );
  }

  return (
    <View style={[styles.squircle, style]} pointerEvents="none">
      <LazyCameraVerifier style={styles.cam} onTracking={setConfidence} />
      {showTrackingRing ? <TrackingRing confidence={confidence} borderRadius={SQUIRCLE_RADIUS} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  squircle: {
    width: SQUIRCLE_WIDTH,
    height: SQUIRCLE_HEIGHT,
    borderRadius: SQUIRCLE_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundDeep,
  },
  cam: { flex: 1 },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 8 },
  placeholderText: { ...typography.label, color: colors.textSecondary, fontWeight: '800' },
  placeholderSub: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
