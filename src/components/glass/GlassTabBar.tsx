import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glass, glassRadius, glow, hitSlop, light } from '@/theme';
import { GlassCluster } from './GlassCluster';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconComponent } from './Icon';
import { CalendarDays, ChartColumn, House, UserRound } from './icons';

/** Every nav target is this square, so the Home circle and the pill read as one size. */
const NAV_SIZE = 52;
/** Glass halo left around the dark selected disc, so it reads as sitting in the glass. */
const DISC_INSET = 3;

interface PillTabProps {
  icon: IconComponent;
  active: boolean;
  onPress: () => void;
  label: string;
}

/** A tap target inside the shared pill; a solid dark disc + white glyph when selected. */
function PillTab({ icon, active, onPress, label }: PillTabProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
    >
      {active ? <View style={styles.selectedDisc} pointerEvents="none" /> : null}
      <Icon icon={icon} size={23} color={active ? light.white : light.inkMuted} strokeWidth={active ? 2 : 1.75} />
    </Pressable>
  );
}

/**
 * The floating liquid-glass nav: a Home anchor and, a hair to its right, one
 * continuous frosted pill holding the other live destinations (History, Profile)
 * as tap targets. Home stays a glass body at ALL times so its fluid merge into
 * the pill (iOS 26) is always present; selection — on any tab — is a solid dark
 * disc drawn on top, so the selected target always reads the same. It re-presents
 * the Expo Router tab list, so every route stays reachable.
 */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  const goTo = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeName !== name && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const homeActive = activeName === 'index';

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <GlassCluster spacing={22} style={styles.group}>
        {/* Home is always glass (so it always merges into the pill); the dark disc is an overlay. */}
        <Pressable
          onPress={() => goTo('index')}
          accessibilityRole="button"
          accessibilityLabel="Home"
          accessibilityState={{ selected: homeActive }}
          style={({ pressed }) => [styles.homeShadow, glow.floating, { opacity: pressed ? 0.85 : 1 }]}
        >
          <GlassSurface radius={NAV_SIZE / 2} intensity="regular" fill={glass.fill} style={styles.home}>
            {homeActive ? <View style={styles.selectedDisc} pointerEvents="none" /> : null}
            <Icon icon={House} size={24} color={homeActive ? light.white : light.inkSoft} strokeWidth={homeActive ? 2 : 1.9} />
          </GlassSurface>
        </Pressable>

        {/* One continuous glass pill; the icons are tap targets within it, not separate circles. */}
        <View style={[styles.pillShadow, glow.floating]}>
          <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={styles.pill}>
            <PillTab icon={ChartColumn} active={activeName === 'stats'} onPress={() => goTo('stats')} label="Stats" />
            <PillTab icon={CalendarDays} active={activeName === 'history'} onPress={() => goTo('history')} label="History" />
            <PillTab icon={UserRound} active={activeName === 'profile'} onPress={() => goTo('profile')} label="Profile" />
          </GlassSurface>
        </View>
      </GlassCluster>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  homeShadow: { borderRadius: NAV_SIZE / 2 },
  home: { width: NAV_SIZE, height: NAV_SIZE, alignItems: 'center', justifyContent: 'center' },

  pillShadow: { borderRadius: glassRadius.pill },
  pill: { height: NAV_SIZE, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  tab: { width: NAV_SIZE, height: NAV_SIZE, alignItems: 'center', justifyContent: 'center' },

  // The single, consistent selected indicator across every tab: a solid dark disc
  // with a thin glass halo, drawn on top of the glass so the merge stays intact.
  selectedDisc: {
    position: 'absolute',
    top: DISC_INSET,
    bottom: DISC_INSET,
    left: DISC_INSET,
    right: DISC_INSET,
    borderRadius: glassRadius.pill,
    backgroundColor: light.ink,
  },
});
