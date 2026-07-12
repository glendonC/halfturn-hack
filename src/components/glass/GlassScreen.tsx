import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { accents, bloom, spacing, underglowSecondary, type AccentKey } from '@/theme';
import { ScrollEdgeFades } from './ScrollEdgeFades';

interface GlassScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Tints the glow that pools behind the nav toward a section accent. */
  accent?: AccentKey;
  /** Fade the tab scene through a veil without changing native-glass opacity. */
  transitionOnFocus?: boolean;
  /** Let scrolling content travel behind the status area, where the top fade can soften it. */
  scrollUnderTop?: boolean;
}

/**
 * The light, high-key screen shell. A lavender-to-pearl gradient fills the frame;
 * a bright over-exposed white bloom sits up top like the reference's ghosted hero;
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
  transitionOnFocus = false,
  scrollUnderTop = false,
}: GlassScreenProps) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const sceneVeil = useRef(new Animated.Value(transitionOnFocus ? 1 : 0)).current;
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const inner = [padded && styles.padded, scroll && scrollUnderTop && { paddingTop: insets.top + spacing.sm }, contentStyle];
  const safeEdges = scrollUnderTop ? edges.filter((edge) => edge !== 'top') : edges;
  const accentSolid = accent ? accents[accent].solid : undefined;
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(Math.max(0, event.nativeEvent.contentOffset.y));
  }, []);
  const showTopFade = scroll && scrollY > 4;
  const showBottomFade = scroll && contentHeight > viewportHeight && scrollY + viewportHeight < contentHeight - 4;
  useEffect(() => {
    if (!transitionOnFocus) return;
    if (focused) {
      sceneVeil.setValue(1);
      Animated.timing(sceneVeil, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(sceneVeil, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    }
  }, [focused, sceneVeil, transitionOnFocus]);
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

      <SafeAreaView style={styles.safe} edges={safeEdges}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, inner]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
            onContentSizeChange={(_width, height) => setContentHeight(height)}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, inner]}>{children}</View>
        )}
        {scroll ? (
          <ScrollEdgeFades top={showTopFade} bottom={showBottomFade} topInset={scrollUnderTop ? insets.top : 0} />
        ) : null}
        {transitionOnFocus ? (
          <Animated.View pointerEvents="none" style={[styles.sceneVeil, { opacity: sceneVeil }]} />
        ) : null}
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
  sceneVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F6F2FA' },
});
