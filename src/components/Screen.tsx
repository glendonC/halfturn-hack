import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing } from '@/theme';
import { colors } from '@/theme/colors';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  background?: string;
}

/** Safe-area screen wrapper with the app background and optional scrolling. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  background = colors.background,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={edges}>
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
  scrollContent: { paddingBottom: spacing.xxxl, paddingTop: spacing.sm },
});
