import Constants from 'expo-constants';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassButton,
  GlassCard,
  GlassScreen,
  GlassSegmented,
  GlassSlider,
  GlassToggleRow,
  GradientSquircle,
  Icon,
  Icons,
} from '@/components/glass';
import { RATE_BOUNDS, VOLUME_BOUNDS } from '@/constants/defaults';
import { configureAudioSession, getAudioCueEngine } from '@/services/audio';
import { clearAllSessions } from '@/services/db';
import { useProfileStore, useSettingsStore } from '@/state';
import { glassRadius, glassType, hitSlop, light, spacing } from '@/theme';
import type { AudioOutputMode } from '@/types';

/** Space the floating nav reserves at the bottom, so the last card clears it. */
const NAV_CLEARANCE = 96;

/** Up to two initials from the player's name, for the avatar. */
function initialsOf(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase() || null;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);

  const [name, setName] = useState(displayName ?? '');
  const nameRef = useRef<TextInput>(null);
  const initials = initialsOf(name);

  const commitName = () => {
    const trimmed = name.trim();
    setDisplayName(trimmed);
    setName(trimmed);
  };

  const testVoice = async () => {
    try {
      await configureAudioSession(settings.audioOutputMode);
      const engine = getAudioCueEngine(settings.audioSource);
      await engine.prepare(settings);
      void engine.speak('Check left. Man on. Turn.');
    } catch (err) {
      console.warn('[profile] test voice failed', err);
    }
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear all history?',
      'This permanently deletes every saved drill.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearAllSessions(),
        },
      ],
    );
  };

  return (
    <GlassScreen
      scroll
      accent="voice"
      contentStyle={{ paddingBottom: insets.bottom + NAV_CLEARANCE }}
    >
      <View style={styles.header}>
        <GradientSquircle
          accent="voice"
          radius={glassRadius.squircle}
          style={styles.avatar}
        >
          <View style={styles.avatarInner}>
            {initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <Icon
                icon={Icons.UserRound}
                size={30}
                color={light.inkSoft}
                strokeWidth={1.75}
              />
            )}
          </View>
        </GradientSquircle>
        <View style={styles.headerText}>
          <Text style={styles.headerOverline}>Player</Text>
          <View style={styles.nameRow}>
            <TextInput
              ref={nameRef}
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              placeholder="Add your name"
              placeholderTextColor={light.inkFaint}
              returnKeyType="done"
              maxLength={40}
              autoCapitalize="words"
            />
            <Pressable
              onPress={() => nameRef.current?.focus()}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Edit name"
              style={({ pressed }) => [
                styles.editBtn,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Icon
                icon={Icons.SquarePen}
                size={18}
                color={light.inkMuted}
                strokeWidth={1.75}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.groupHeading}>Preferences</Text>

      <GlassCard title="Background music" style={styles.card}>
        <GlassSegmented<AudioOutputMode>
          options={[
            { label: 'Lower it', value: 'headphones' },
            { label: 'Keep it up', value: 'speaker' },
          ]}
          value={settings.audioOutputMode}
          onChange={(v) => setSetting('audioOutputMode', v)}
          accent="audio"
        />
        <Text style={styles.note}>
          When a cue plays, duck your music or let it keep going. Output —
          AirPods, Bluetooth, or the speaker — is picked automatically by iOS.
        </Text>
      </GlassCard>

      <GlassCard title="Voice" style={styles.card}>
        <GlassSlider
          label="Volume"
          value={settings.cueVolume}
          min={VOLUME_BOUNDS.min}
          max={VOLUME_BOUNDS.max}
          step={VOLUME_BOUNDS.step}
          valueLabel={`${Math.round(settings.cueVolume * 100)}%`}
          accent="voice"
          onValueChange={(v) => setSetting('cueVolume', v)}
        />
        <GlassSlider
          label="Speed"
          value={settings.speechRate}
          min={RATE_BOUNDS.min}
          max={RATE_BOUNDS.max}
          step={RATE_BOUNDS.step}
          valueLabel={`${settings.speechRate.toFixed(2)}×`}
          accent="voice"
          onValueChange={(v) => setSetting('speechRate', v)}
        />
        <GlassButton
          label="Test voice"
          variant="secondary"
          icon={Icons.Volume2}
          onPress={testVoice}
        />
      </GlassCard>

      <GlassCard title="Feedback" style={styles.card}>
        <GlassToggleRow
          label="Haptics"
          description="Buzz on every cue for eyes-free reinforcement."
          value={settings.hapticsEnabled}
          onValueChange={(v) => setSetting('hapticsEnabled', v)}
          accent="feedback"
        />
        <Divider />
        <GlassToggleRow
          label="Keep screen awake"
          description="Prevent the screen from locking during a drill."
          value={settings.keepAwake}
          onValueChange={(v) => setSetting('keepAwake', v)}
          accent="feedback"
        />
      </GlassCard>

      <GlassCard title="Field display" style={styles.card}>
        <GlassToggleRow
          label="Boost brightness"
          description="Max out brightness while a drill runs; restores it after."
          value={settings.brightnessBoost}
          onValueChange={(v) => setSetting('brightnessBoost', v)}
          accent="field"
        />
        <Divider />
        <GlassToggleRow
          label="Landscape in Turn & React"
          description="Rotate to landscape for a wider cue at distance."
          value={settings.turnReactLandscape}
          onValueChange={(v) => setSetting('turnReactLandscape', v)}
          accent="field"
        />
      </GlassCard>

      <GlassCard title="Data" style={styles.card}>
        <GlassButton
          label="Clear history"
          variant="danger"
          icon={Icons.Trash2}
          onPress={clearHistory}
        />
        <Text style={styles.version}>
          HalfTurn v{Constants.expoConfig?.version ?? '0.1.0'} · local-first
        </Text>
      </GlassCard>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  avatar: { width: 72, height: 72 },
  avatarInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...glassType.title, fontSize: 26, color: light.inkSoft },
  headerText: { flex: 1, gap: 2 },
  headerOverline: { ...glassType.overline, color: light.inkMuted },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    ...glassType.hero,
    fontSize: 34,
    lineHeight: 40,
    color: light.ink,
    padding: 0,
    flex: 1,
  },
  editBtn: { padding: 6 },

  groupHeading: {
    ...glassType.overline,
    color: 'rgba(24,20,37,0.45)',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: { marginBottom: spacing.md },

  note: {
    ...glassType.caption,
    color: 'rgba(24,20,37,0.55)',
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(24,20,37,0.12)',
  },
  version: {
    ...glassType.caption,
    color: 'rgba(24,20,37,0.5)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
