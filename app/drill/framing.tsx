import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackingLevelColor } from '@/components';
import {
  GlassCluster,
  GlassScreen,
  GlassSurface,
  Icon,
  Icons,
  type IconComponent,
} from '@/components/glass';
import { isInFrame } from '@/constants/visionTuning';
import {
  configureAudioSession,
  getAudioCueEngine,
  playBeep,
  primeBeep,
} from '@/services/audio';
import {
  FRAMING_SPOKEN,
  LazyCameraVerifier,
  useFramingCalibration,
} from '@/services/vision';
import { useSettings } from '@/state';
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

/**
 * Same chrome recipe as `GlassTabBar`: 52pt row, `intensity="regular"` +
 * `fill={glass.fill}`, clustered so adjacent shapes can fluid-merge on iOS 26+.
 */
const BAR = 52;

/**
 * Turn & React framing / calibration (dev build only — reached from setup when
 * VISION_ENABLED). Presentational: the capture state machine + yaw-sign math
 * live in `useFramingCalibration`; this screen just renders the camera, the
 * in-frame indicator, and the per-phase capture control — plus eyes-off audio
 * coaching, since the player faces away from the phone during capture.
 */
export default function FramingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const cal = useFramingCalibration();
  const startDrill = useCallback(() => router.replace('/drill/active'), [router]);

  // Same remount trick as GlassTabBar — Liquid Glass can stick on first paint.
  const [glassEpoch, setGlassEpoch] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGlassEpoch((n) => n + 1));
    return () => cancelAnimationFrame(id);
  }, []);

  // Warm TTS + beep on the player's voice settings so the first coach line isn't cold.
  const engineRef = useRef(getAudioCueEngine(settings.audioSource));
  useEffect(() => {
    const engine = getAudioCueEngine(settings.audioSource);
    engineRef.current = engine;
    void (async () => {
      await configureAudioSession(settings.audioOutputMode);
      await engine.prepare(settings);
      primeBeep();
    })();
    return () => {
      void engine.stop();
    };
  }, [settings]);

  // Phase lines — the main eyes-off script.
  useEffect(() => {
    void engineRef.current.speak(FRAMING_SPOKEN[cal.phase]);
  }, [cal.phase]);

  // Capture beats: hold / got-it / retry.
  useEffect(() => {
    const pulse = cal.coachPulse;
    if (!pulse) return;
    const haptics = settings.hapticsEnabled;
    if (pulse.kind === 'hold') {
      void engineRef.current.speak('Hold');
      if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    if (pulse.kind === 'ok') {
      playBeep();
      if (haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    // retry
    void engineRef.current.speak('Could not see you. Step into frame and try again.');
    if (haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [cal.coachPulse, settings.hapticsEnabled]);

  const ready = cal.phase === 'ready';
  const showLastSetup = !ready && cal.hasSaved;
  const primaryLabel = ready
    ? 'Start drill'
    : cal.capturing
      ? 'Hold…'
      : cal.phase === 'center'
        ? 'Capture center'
        : 'Capture left';
  const primaryIcon = ready ? Icons.Play : Icons.Camera;

  return (
    <GlassScreen accent="home" edges={['top', 'left', 'right']} padded={false}>
      <View style={styles.body}>
        <View style={[styles.cameraShadow, glow.card]}>
          <View style={styles.cameraBox}>
            <LazyCameraVerifier style={styles.camera} onSample={cal.onSample} onTracking={cal.onTracking} />
            <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.trackPill}>
              <View style={[styles.trackDot, { backgroundColor: trackingLevelColor(cal.confidence) }]} />
              <Text style={styles.trackText}>{isInFrame(cal.confidence) ? 'In frame' : 'Step into frame'}</Text>
            </GlassSurface>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.kicker}>Framing · Turn & React</Text>
          <Text style={styles.instruction}>{cal.instruction}</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
        <GlassCluster key={glassEpoch} spacing={22} style={styles.actionRow}>
          {/* Never put opacity < 1 on a Pressable that parents GlassView — breaks the material. */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.circleShadow}
          >
            <GlassSurface radius={BAR / 2} intensity="regular" fill={glass.fill} style={styles.circle}>
              <Icon icon={Icons.ChevronLeft} size={22} color={light.inkSoft} strokeWidth={1.9} />
            </GlassSurface>
          </Pressable>

          {showLastSetup ? (
            <ActionPill label="Last setup" icon={Icons.Repeat} onPress={startDrill} flex={1} muted />
          ) : null}

          <ActionPill
            label={primaryLabel}
            icon={primaryIcon}
            onPress={ready ? startDrill : cal.capture}
            disabled={cal.capturing}
            loading={cal.capturing}
            flex={showLastSetup ? 1.35 : 1}
          />
        </GlassCluster>
      </View>
    </GlassScreen>
  );
}

function ActionPill({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
  muted = false,
  flex = 1,
}: {
  label: string;
  icon: IconComponent;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  muted?: boolean;
  flex?: number;
}) {
  return (
    <View style={[styles.pillShadow, { flex }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pillPress}
      >
        <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.pill}>
          {loading ? (
            <ActivityIndicator color={light.inkSoft} size="small" />
          ) : (
            <Icon
              icon={icon}
              size={18}
              color={muted || disabled ? light.inkMuted : light.ink}
              strokeWidth={2}
            />
          )}
          <Text
            style={[styles.pillLabel, (muted || disabled) && styles.pillLabelMuted]}
            numberOfLines={1}
          >
            {label}
          </Text>
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
    gap: spacing.lg,
  },

  cameraShadow: { flex: 1, borderRadius: glassRadius.squircle },
  cameraBox: {
    flex: 1,
    borderRadius: glassRadius.squircle,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: light.mist,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
  },
  camera: { flex: 1 },

  trackPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trackDot: { width: 9, height: 9, borderRadius: 5 },
  trackText: { ...glassType.caption, color: light.inkSoft, fontWeight: '700' },

  copy: { gap: spacing.sm, paddingBottom: spacing.xs },
  kicker: { ...glassType.overline, color: accents.home.solid },
  instruction: { ...glassType.subtitle, color: light.ink, lineHeight: 24 },

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
  pillLabelMuted: { color: light.inkMuted, fontWeight: '500' },
});
