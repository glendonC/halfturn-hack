import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import {
  Delegate,
  MediapipeCamera,
  RunningMode,
  usePoseDetection,
  type PoseDetectionResultBundle,
} from 'react-native-mediapipe-posedetection';

import { colors, typography } from '@/theme';

import { feedRawFrame, toRawPoseFrame } from './backends/MediaPipeBackend';
import { recordFrameStat, resetDiagnostics } from './diagnostics';
import type { RawPoseFrame } from './PerceptionBackend';

/**
 * DEV-BUILD ONLY camera + MediaPipe Pose preview. Reached only via the lazy
 * dynamic import in LazyCameraVerifier (so its react-native-vision-camera /
 * react-native-mediapipe-posedetection imports never enter the Expo Go bundle —
 * this is an allow-listed file for the CI guard).
 *
 * It runs `usePoseDetection` (LIVE_STREAM, lite model, single subject, GPU) and
 * forwards every converted frame to the active verifier (`feedRawFrame`) and to
 * `onSample` (used by the framing/calibration screen). All yaw/scan math stays in
 * the pure YawFusion + detectScans behind the verifier — unchanged.
 */

const POSE_MODEL = 'pose_landmarker_lite.task';
const L_SHOULDER = 11;
const R_SHOULDER = 12;

export interface CameraVerifierProps {
  style?: StyleProp<ViewStyle>;
  /** 'front' (default): the phone faces the player, screen toward them. */
  activeCamera?: 'front' | 'back';
  /** Receives every converted frame (used by the framing/calibration capture). */
  onSample?: (raw: RawPoseFrame) => void;
  /** Latest tracking confidence (min shoulder visibility) for the health overlay. */
  onTracking?: (confidence: number) => void;
}

export function CameraVerifierView({
  style,
  activeCamera = 'front',
  onSample,
  onTracking,
}: CameraVerifierProps) {
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // Fresh diagnostics window per camera mount (one drill / framing session).
  useEffect(() => {
    resetDiagnostics();
  }, []);

  const solution = usePoseDetection(
    {
      onResults: (bundle: PoseDetectionResultBundle) => {
        const raw = toRawPoseFrame(bundle);
        if (!raw) return;
        feedRawFrame(raw); // → the active verifier during a drill (no-op otherwise)
        onSample?.(raw); // → framing/calibration capture
        // Tracking confidence = min shoulder visibility. Feed the dev diagnostics
        // ring every frame (cheap) and forward to the health overlay when wired.
        const conf = Math.min(
          raw.visibility?.[L_SHOULDER] ?? 0,
          raw.visibility?.[R_SHOULDER] ?? 0,
        );
        recordFrameStat(raw.inferenceMs ?? 0, conf);
        onTracking?.(conf);
      },
      onError: () => {
        // Transient detection errors are non-fatal; the run degrades to 0 scans.
      },
    },
    RunningMode.LIVE_STREAM,
    POSE_MODEL,
    {
      numPoses: 1, // single-subject lock (perception-architecture §3.4)
      delegate: Delegate.GPU, // lite + GPU for the ~15fps native target
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      shouldOutputSegmentationMasks: false,
      fpsMode: 'none', // no extra throttle; the plugin caps at ~15fps in native
    },
  );

  if (!hasPermission) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>
          Camera permission is needed for Turn &amp; React.
        </Text>
      </View>
    );
  }

  return (
    <MediapipeCamera
      style={StyleSheet.flatten([styles.camera, style]) as ViewStyle}
      solution={solution}
      activeCamera={activeCamera}
    />
  );
}

export default CameraVerifierView;

const styles = StyleSheet.create({
  camera: { flex: 1 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 16,
  },
  fallbackText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
