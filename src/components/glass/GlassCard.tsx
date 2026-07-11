import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { glassRadius, glassType, glow, spacing } from '@/theme';
import { GlassSurface } from './GlassSurface';

interface GlassCardProps {
  children: ReactNode;
  /** Small uppercase overline label. */
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  /** Trailing element in the header row (e.g. a value or control). */
  trailing?: ReactNode;
}

/** A frosted card that groups related controls, lifted off the bloom with a soft glow. */
export function GlassCard({ children, title, subtitle, style, trailing }: GlassCardProps) {
  return (
    <View style={[styles.shadow, style]}>
      <GlassSurface radius={glassRadius.card} intensity="regular" style={styles.card}>
        {title || trailing ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {trailing ?? null}
          </View>
        ) : null}
        {children}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: glassRadius.card, ...glow.card },
  card: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1, gap: 3 },
  title: { ...glassType.overline },
  subtitle: { ...glassType.caption },
});
