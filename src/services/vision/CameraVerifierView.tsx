import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, typography } from '@/theme';

import type { RawPoseFrame } from './PerceptionBackend';

/**
 * Camera preview shell for framing / in-drill self-view.
 *
 * Native VisionCamera + MediaPipe imports deliberately do NOT live here yet —
 * those packages are not on the Expo Go graph. When linked in a custom client,
 * replace this placeholder body with the real camera hook and call onSample /
 * feedRawFrame. LazyCameraVerifier keeps this module out of Expo Go evaluation
 * via dynamic import behind canUseNativeVision().
 */

export interface CameraVerifierProps {
  style?: StyleProp<ViewStyle>;
  activeCamera?: 'front' | 'back';
  onSample?: (raw: RawPoseFrame) => void;
  onTracking?: (confidence: number) => void;
}

export function CameraVerifierView({
  style,
  onTracking,
}: CameraVerifierProps) {
  useEffect(() => {
    onTracking?.(0);
  }, [onTracking]);

  return (
    <View style={[styles.box, style]}>
      <Text style={styles.title}>Camera preview</Text>
      <Text style={styles.body}>
        Native VisionCamera / MediaPipe are not linked in this build. Framing
        calibration still works with “Use last setup”; pose samples arrive once
        the custom-client camera module is wired into this view.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
