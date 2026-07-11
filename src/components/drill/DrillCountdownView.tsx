import { StyleSheet, Text, View } from 'react-native';

import { COUNTDOWN_FLOOD, HUD_NEUTRAL } from './cueColors';

/**
 * Pre-roll countdown digits. Parent may wrap with cancel / safe-area chrome.
 */
export function DrillCountdownView({
  value,
  hint,
}: {
  value: number;
  hint?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.number}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  number: {
    fontSize: 160,
    fontWeight: '900',
    color: COUNTDOWN_FLOOD.text,
    lineHeight: 170,
  },
  hint: {
    color: HUD_NEUTRAL.muted,
    fontSize: 18,
    fontWeight: '600',
  },
});
