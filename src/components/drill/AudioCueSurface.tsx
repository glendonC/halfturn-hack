import { StyleSheet, Text, View } from 'react-native';

import type { CueSide } from '@/types';

/**
 * Audio-mode cue flood content: giant word (+ side chevrons for directional).
 * Parent owns the flood background color.
 */
export function AudioCueSurface({
  label,
  textColor,
  side = 'none',
}: {
  label: string;
  textColor: string;
  side?: CueSide;
}) {
  const showLeft = side === 'left';
  const showRight = side === 'right';

  return (
    <View style={styles.center}>
      {showLeft ? (
        <Text style={[styles.chevron, { color: textColor }]}>‹</Text>
      ) : (
        <View style={styles.chevronSpacer} />
      )}
      <Text
        style={[styles.cue, { color: textColor }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      {showRight ? (
        <Text style={[styles.chevron, { color: textColor }]}>›</Text>
      ) : (
        <View style={styles.chevronSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cue: {
    flexShrink: 1,
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 78,
    textAlign: 'center',
  },
  chevron: {
    fontSize: 96,
    fontWeight: '900',
    marginHorizontal: 4,
  },
  chevronSpacer: {
    width: 28,
  },
});
