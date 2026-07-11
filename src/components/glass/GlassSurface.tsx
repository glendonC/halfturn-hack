import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glass, glassRadius } from '@/theme';
import { getNativeGlass } from './liquidGlassNative';

type Intensity = 'thin' | 'regular' | 'thick';

export interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Continuous-corner radius. */
  radius?: number;
  /** Blur strength (fallback) / glass thickness. */
  intensity?: Intensity;
  /** Native glass material. `clear` is lighter/more transparent than `regular`. */
  glassStyle?: 'clear' | 'regular';
  /** Let touches/scroll behind the glass distort it (native only). */
  interactive?: boolean;
  /** Optional color wash over the glass (e.g. an accent tint). */
  tintColor?: string;
  /** Fallback fill over the blur. Use `glass.fillStrong` for selected/emphasized. */
  fill?: string;
  /** Draw the bright hairline edge. */
  bordered?: boolean;
}

/**
 * The frosted-glass material primitive. Renders a native `GlassView` on iOS 26+
 * (via the isolated `liquidGlassNative` loader) and an `expo-blur` + translucent
 * fill everywhere else. Pure material only — it clips its content and draws no
 * shadow; wrap it in a `glow`-styled View when you want it to lift off the page.
 */
export function GlassSurface({
  children,
  style,
  radius = glassRadius.card,
  intensity = 'regular',
  glassStyle = 'regular',
  interactive = false,
  tintColor,
  fill,
  bordered = true,
}: GlassSurfaceProps) {
  const shape: ViewStyle = { borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden' };
  const border: ViewStyle | null = bordered
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: glass.border }
    : null;

  const native = getNativeGlass();
  if (native) {
    const { GlassView } = native;
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        isInteractive={interactive}
        colorScheme="light"
        tintColor={tintColor}
        style={[shape, border, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[shape, border, style]}>
      <BlurView tint="light" intensity={glass.blur[intensity]} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill ?? glass.fill }]} />
      {tintColor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} /> : null}
      {/* Top-lit sheen so the surface reads as glass. */}
      <LinearGradient
        colors={glass.sheen}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
