import { StyleSheet, Text, View } from 'react-native';

import { glassType, light } from '@/theme';

/** Full-bleed "PAUSED" scrim shown over either running layout while paused. */
export function PausedOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.text}>Paused</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,242,250,0.72)',
  },
  text: {
    ...glassType.hero,
    fontSize: 56,
    lineHeight: 62,
    color: light.ink,
    letterSpacing: -1,
  },
});
