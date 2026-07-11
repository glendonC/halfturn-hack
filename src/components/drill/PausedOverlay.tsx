import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

/** Full-bleed "PAUSED" scrim shown over either running layout while paused. */
export function PausedOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.text}>PAUSED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,20,0.72)',
  },
  text: {
    ...typography.title,
    color: colors.text,
    letterSpacing: 4,
  },
});
