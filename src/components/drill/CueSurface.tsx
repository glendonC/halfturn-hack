import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface CueSurfaceProps {
  /** The cue content (flood word / turn-react reveal). */
  children: ReactNode;
}

/**
 * Named "what to react to" region. Layouts compose chrome around this so
 * audio and turn-react share transport and differ only in the cue surface.
 */
export function CueSurface({ children }: CueSurfaceProps) {
  return <View style={styles.surface}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
});
