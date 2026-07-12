import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { POSE_OVERLAY_IDX, type PoseOverlayFeed } from '@/services/vision';
import { motion } from '@/theme';

/** Treat the subject as lost this long after frames stop arriving. */
const STALE_MS = 600;
/** How far the edge light reaches into the view. */
const GLOW_DEPTH = 52;
/** One inhale-exhale of the edge glow. */
const BREATH_MS = 2600;
/** Breath floor — the glow never fully stills, only softens. */
const BREATH_MIN = 0.72;
/** Field energy when no body is tracked — barely alive, still "listening". */
const LOST_ENERGY = 0.15;
/** Ignore energy retargets smaller than this (keeps 15fps updates cheap). */
const ENERGY_DEADBAND = 0.04;

/** Luminous edge light: white-violet at the border, dissolving inward. */
const GLOW_IN = [
  'rgba(244,240,255,0.60)',
  'rgba(199,183,245,0.20)',
  'rgba(199,183,245,0)',
] as const;
const GLOW_OUT = [
  'rgba(199,183,245,0)',
  'rgba(199,183,245,0.20)',
  'rgba(244,240,255,0.60)',
] as const;
const GLOW_IN_STOPS = [0, 0.4, 1] as const;
const GLOW_OUT_STOPS = [0, 0.6, 1] as const;

/** Focus brackets: inset from each corner, with a small relax/tighten travel. */
const BRACKET_INSET = 14;
/** Bracket drawing box (px); each leg spans most of it. */
const BRACKET_BOX = 24;
/** How far a bracket rests OUTWARD when tracking is lost (tightens to 0). */
const BRACKET_RELAX = 5;

/** The four corners: layout anchor + mirror signs for the shared L path. */
const CORNERS = [
  { key: 'tl', anchor: { top: BRACKET_INSET, left: BRACKET_INSET }, sx: 1, sy: 1 },
  { key: 'tr', anchor: { top: BRACKET_INSET, right: BRACKET_INSET }, sx: -1, sy: 1 },
  { key: 'bl', anchor: { bottom: BRACKET_INSET, left: BRACKET_INSET }, sx: 1, sy: -1 },
  { key: 'br', anchor: { bottom: BRACKET_INSET, right: BRACKET_INSET }, sx: -1, sy: -1 },
] as const;

interface ScanFieldOverlayProps {
  /** The camera's per-frame skeleton feed — used only for presence/confidence. */
  feed: PoseOverlayFeed;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Vision is focusing on you" overlay for the framing camera: a luminous
 * gradient breathing around the inside of the edges — light gathering at the
 * border and dissolving toward you — framed by four thin viewfinder brackets
 * that TIGHTEN inward and brighten when tracking locks on, and relax outward
 * and dim when the subject is lost. Instrument optics, not decoration. The
 * squircle border stays crisp (the glow is light, not fog) and nothing is
 * drawn ON the body, so the effect never depends on the shaky 15fps
 * landmark↔preview registration.
 *
 * The pill + checklist stay for the precise "what does vision see" readout;
 * this layer is the ambient version of the same signal.
 *
 * Perf contract: subscribes to the pose feed and drives Animated values
 * directly (native driver, opacity/transform only) — zero per-frame setState.
 */
export function ScanFieldOverlay({ feed, style }: ScanFieldOverlayProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  const energy = useRef(new Animated.Value(LOST_ENERGY)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const lastTarget = useRef(LOST_ENERGY);
  const staleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Tracking → field energy. Shoulder visibility is the pipeline's load-bearing
  // confidence signal (same as the tracking pill), mapped onto a dim…bright ramp.
  useEffect(() => {
    const retarget = (target: number) => {
      if (Math.abs(target - lastTarget.current) < ENERGY_DEADBAND) return;
      lastTarget.current = target;
      Animated.timing(energy, {
        toValue: target,
        duration: motion.duration.slow,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    };
    const unsubscribe = feed.subscribe((frame) => {
      if (staleRef.current) clearTimeout(staleRef.current);
      if (!frame) {
        retarget(LOST_ENERGY);
        return;
      }
      const v = (i: number) => frame.points[i]?.v ?? 0;
      const conf = Math.min(v(POSE_OVERLAY_IDX.lShoulder), v(POSE_OVERLAY_IDX.rShoulder));
      retarget(0.45 + 0.55 * conf);
      staleRef.current = setTimeout(() => retarget(LOST_ENERGY), STALE_MS);
    });
    return () => {
      unsubscribe();
      if (staleRef.current) clearTimeout(staleRef.current);
    };
  }, [feed, energy]);

  // The glow inhales and exhales — attention, not alarm.
  useEffect(() => {
    if (reduceMotion) return;
    breath.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, breath]);

  const glowOpacity = reduceMotion
    ? energy
    : Animated.multiply(
        energy,
        breath.interpolate({ inputRange: [0, 1], outputRange: [BREATH_MIN, 1] }),
      );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <LinearGradient colors={GLOW_IN} locations={GLOW_IN_STOPS} style={styles.glowTop} />
        <LinearGradient colors={GLOW_OUT} locations={GLOW_OUT_STOPS} style={styles.glowBottom} />
        <LinearGradient
          colors={GLOW_IN}
          locations={GLOW_IN_STOPS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.glowLeft}
        />
        <LinearGradient
          colors={GLOW_OUT}
          locations={GLOW_OUT_STOPS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.glowRight}
        />
      </Animated.View>

      {CORNERS.map((corner) => (
        <FocusBracket key={corner.key} corner={corner} energy={energy} />
      ))}
    </View>
  );
}

/**
 * One corner bracket. Lock-on is spatial, not blinking: tracking confidence
 * pulls the bracket to its tight seat and full weight; losing the subject
 * lets it drift a few px outward and fade back. Ink underlay keeps the white
 * stroke legible on bright video (same trick as the glass HUD chrome).
 */
function FocusBracket({
  corner,
  energy,
}: {
  corner: (typeof CORNERS)[number];
  energy: Animated.Value;
}) {
  const { anchor, sx, sy } = corner;
  const translateX = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [-sx * BRACKET_RELAX, 0],
  });
  const translateY = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [-sy * BRACKET_RELAX, 0],
  });
  const opacity = energy.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] });

  // Rounded L for the top-left corner; the other corners mirror it via scale.
  const leg = BRACKET_BOX - 4;
  const d = `M 2,${leg} L 2,10 Q 2,2 10,2 L ${leg},2`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        ...anchor,
        width: BRACKET_BOX,
        height: BRACKET_BOX,
        opacity,
        transform: [{ translateX }, { translateY }, { scaleX: sx }, { scaleY: sy }],
      }}
    >
      <Svg width={BRACKET_BOX} height={BRACKET_BOX}>
        <Path d={d} stroke="rgba(24,20,37,0.30)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Path d={d} stroke="rgba(255,255,255,0.95)" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: GLOW_DEPTH },
  glowBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: GLOW_DEPTH },
  glowLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: GLOW_DEPTH },
  glowRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: GLOW_DEPTH },
});
