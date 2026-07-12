import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

interface ScrollEdgeFadesProps {
  top: boolean;
  bottom: boolean;
  topInset?: number;
}

/** Indicates clipped scroll content without intercepting gestures or controls. */
export function ScrollEdgeFades({ top, bottom, topInset = 0 }: ScrollEdgeFadesProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {top ? (
        <LinearGradient
          colors={['rgba(246,242,250,0.99)', 'rgba(246,242,250,0.9)', 'rgba(246,242,250,0)']}
          locations={[0, 0.5, 1]}
          style={[styles.top, { height: topInset + 48 }]}
        />
      ) : null}
      {bottom ? (
        <LinearGradient
          colors={['rgba(237,231,246,0)', 'rgba(237,231,246,0.96)']}
          style={styles.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 },
});
