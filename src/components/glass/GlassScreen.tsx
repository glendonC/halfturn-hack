import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { accents, bloom, spacing, underglowSecondary, type AccentKey } from '@/theme';

interface GlassScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Tints the glow that pools behind the nav toward a section accent. */
  accent?: AccentKey;
}

/**
 * The light, high-key screen shell. A lavender-to-pearl gradient fills the frame;
 * a bright over-exposed white bloom sits up top like a soft ghosted hero;
 * and — when an accent is set — a soft pool of that color plus periwinkle glows up
 * from the bottom, so the frosted nav floats on merged colored light.
 */
export function GlassScreen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  accent,
}: GlassScreenProps) {
  const inner = [padded && styles.padded, contentStyle];
  const accentSolid = accent ? accents[accent].solid : undefined;
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={bloom.colors}
        locations={bloom.locations}
        start={bloom.start}
        end={bloom.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Over-exposed white bloom, top-center. */}
      <View style={styles.topGlow} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="34%" rx="72%" ry="64%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bloom)" />
        </Svg>
      </View>

      {/* Accent + periwinkle pooling behind the nav. */}
      {accentSolid ? (
        <View style={styles.bottomGlow} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="a1" cx="34%" cy="100%" rx="52%" ry="86%">
                <Stop offset="0" stopColor={accentSolid} stopOpacity="0.5" />
                <Stop offset="1" stopColor={accentSolid} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="a2" cx="72%" cy="100%" rx="50%" ry="86%">
                <Stop offset="0" stopColor={underglowSecondary} stopOpacity="0.42" />
                <Stop offset="1" stopColor={underglowSecondary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#a1)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#a2)" />
          </Svg>
        </View>
      ) : null}

      <SafeAreaView style={styles.safe} edges={edges}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, inner]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, inner]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
  scrollContent: { paddingBottom: spacing.huge, paddingTop: spacing.sm },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: '52%' },
  bottomGlow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%' },
});
