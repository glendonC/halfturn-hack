import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassActionPill,
  GlassButton,
  GlassCard,
  GlassPageHeader,
  GlassScreen,
  GlassSegmented,
  GlassSlider,
  GlassStat,
  GlassSurface,
  GlassToggleRow,
  GradientSquircle,
  Icon,
  Icons,
} from '@/components/glass';
import { RATE_BOUNDS, VOLUME_BOUNDS } from '@/constants/defaults';
import {
  configureAudioSession,
  getAudioCueEngine,
  listNaturalVoices,
  type VoiceOption,
} from '@/services/audio';
import { clearAllSessions, getHistoryStats, type HistoryStats } from '@/services/db';
import { useProfileStore } from '@/state/useProfileStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import {
  accents,
  glass,
  glassRadius,
  glassType,
  glow,
  hitSlop,
  light,
  spacing,
} from '@/theme';
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

/** Compact preference readout chip inside the identity hero. */
function PrefChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.prefChip}>
      <Text style={styles.prefChipLabel}>{label}</Text>
      <Text style={styles.prefChipValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);

  const [name, setName] = useState(displayName ?? '');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const nameRef = useRef<TextInput>(null);
  const initials = initialsOf(name);

  useEffect(() => {
    let cancelled = false;
    void listNaturalVoices(settings.language).then((list) => {
      if (!cancelled) setVoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.language]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getHistoryStats());
    } catch (err) {
      console.warn('[profile] stats load failed', err);
      setStats({ totalSessions: 0, totalCues: 0, totalDurationSec: 0, sessionsThisWeek: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats]),
  );

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

  const pickVoice = (id: string | null) => {
    setSetting('voiceId', id);
    void (async () => {
      try {
        await configureAudioSession(settings.audioOutputMode);
        const engine = getAudioCueEngine(settings.audioSource);
        await engine.prepare({ ...settings, voiceId: id });
        void engine.speak('Check left.');
      } catch {
        // best-effort preview
      }
    })();
  };

  const clearHistory = () => {
    Alert.alert('Clear all data?', 'This permanently deletes every saved drill from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear data',
        style: 'destructive',
        onPress: async () => {
          await clearAllSessions();
          void loadStats();
        },
      },
    ]);
  };

  const selectedVoice = voices.find((v) => v.identifier === settings.voiceId);
  const speakerLabel = settings.voiceId == null ? 'Auto' : (selectedVoice?.name ?? 'Custom');
  const speakerDetail =
    settings.voiceId == null
      ? 'Best natural Apple voice available'
      : (selectedVoice?.detail ?? 'Natural');

  const voiceChips: { id: string | null; label: string }[] = [
    { id: null, label: 'Auto' },
    ...voices.map((v) => ({ id: v.identifier, label: v.name })),
  ];

  const musicLabel = settings.audioOutputMode === 'headphones' ? 'Ducks' : 'Keeps up';
  const totalSessions = stats?.totalSessions ?? 0;
  const weekSessions = stats?.sessionsThisWeek ?? 0;

  return (
    <GlassScreen scroll scrollUnderTop transitionOnFocus accent="voice" contentStyle={{ paddingBottom: insets.bottom + NAV_CLEARANCE }}>
      <GlassPageHeader
        title="Profile"
        actions={
          <>
            <GlassActionPill label="Test" icon={Icons.Volume2} onPress={testVoice} accent="voice" />
            <GlassActionPill label="Clear data" icon={Icons.Trash2} danger onPress={clearHistory} />
          </>
        }
      />

      {/* Identity hero — same GradientSquircle language as Stats. */}
      <GradientSquircle accent="voice" style={styles.hero}>
        <View style={styles.heroPad}>
          <View style={styles.heroTop}>
            <View style={styles.avatarShadow}>
              <GlassSurface radius={glassRadius.squircle} intensity="thick" fill={glass.fillStrong} style={styles.avatar}>
                <View style={styles.avatarInner}>
                  {initials ? (
                    <Text style={styles.avatarText}>{initials}</Text>
                  ) : (
                    <Icon icon={Icons.UserRound} size={28} color={light.inkSoft} strokeWidth={1.75} />
                  )}
                </View>
              </GlassSurface>
            </View>

            <View style={styles.heroIdentity}>
              <Text style={styles.heroOverline}>Display name</Text>
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
                  style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.55 : 1 }]}
                >
                  <Icon icon={Icons.SquarePen} size={18} color={light.inkMuted} strokeWidth={1.75} />
                </Pressable>
              </View>
              <Text style={styles.heroNote}>Shown on Home when you open a session.</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <GlassStat size="sm" value={String(totalSessions)} label="Sessions" accent="home" />
            <View style={styles.statSep} />
            <GlassStat size="sm" value={String(weekSessions)} label="This week" accent="field" />
            <View style={styles.statSep} />
            <GlassStat size="sm" value={speakerLabel} label="Voice" accent="voice" />
          </View>

          <View style={styles.prefChipRow}>
            <PrefChip label="Music" value={musicLabel} />
            <PrefChip label="Haptics" value={settings.hapticsEnabled ? 'On' : 'Off'} />
            <PrefChip label="Screen" value={settings.keepAwake ? 'Awake' : 'Sleep'} />
            <PrefChip label="Field" value={settings.brightnessBoost ? 'Bright' : 'Normal'} />
          </View>
        </View>
      </GradientSquircle>

      <Text style={styles.groupHeading}>Training preferences</Text>

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
          When a cue plays, duck your music or let it keep going. Output — AirPods, Bluetooth, or the speaker — is picked
          automatically by iOS.
        </Text>
      </GlassCard>

      <GlassCard title="Voice" subtitle={`${speakerLabel} · ${speakerDetail}`} style={styles.card}>
        <View style={styles.chipRow}>
          {voiceChips.map((chip) => {
            const selected =
              chip.id == null ? settings.voiceId == null : settings.voiceId === chip.id;
            return (
              <Pressable
                key={chip.id ?? 'auto'}
                onPress={() => pickVoice(chip.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={chip.label}
                style={styles.chipPress}
              >
                <GlassSurface
                  radius={glassRadius.pill}
                  intensity="regular"
                  fill={selected ? glass.fillStrong : glass.fillSubtle}
                  tintColor={selected ? accents.voice.wash : undefined}
                  style={styles.chip}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{chip.label}</Text>
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>

        {voices.length === 0 ? (
          <Text style={styles.note}>
            Download Samantha, Zoe, Ava, or Tom (Enhanced) in iOS Settings → Accessibility → Spoken Content → Voices.
          </Text>
        ) : null}

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
        <GlassButton label="Test voice" variant="secondary" icon={Icons.Volume2} onPress={testVoice} />
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
          description="Rotate the live cue while a run is active — for a mounted phone read at distance. Setup stays portrait."
          value={settings.turnReactLandscape}
          onValueChange={(v) => setSetting('turnReactLandscape', v)}
          accent="field"
        />
      </GlassCard>

      <Text style={styles.version}>HalfTurn v{Constants.expoConfig?.version ?? '0.1.0'} · local-first</Text>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: spacing.xl },
  heroPad: { padding: spacing.xl, gap: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarShadow: { borderRadius: glassRadius.squircle, ...glow.card },
  avatar: { width: 72, height: 72 },
  avatarInner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...glassType.title, fontSize: 26, color: light.inkSoft },
  heroIdentity: { flex: 1, gap: 4 },
  heroOverline: { ...glassType.overline, color: 'rgba(24,20,37,0.5)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { ...glassType.title, fontSize: 26, lineHeight: 32, color: light.ink, padding: 0, flex: 1 },
  editBtn: { padding: 6 },
  heroNote: { ...glassType.caption, color: 'rgba(24,20,37,0.55)', marginTop: 2 },

  statRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(24,20,37,0.12)', marginVertical: 4 },

  prefChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prefChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: glassRadius.chip,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.75)',
    gap: 2,
    minWidth: 72,
  },
  prefChipLabel: { ...glassType.overline, fontSize: 9, letterSpacing: 1.2, color: 'rgba(24,20,37,0.45)' },
  prefChipValue: { ...glassType.label, fontSize: 13, color: light.inkSoft },

  groupHeading: {
    ...glassType.overline,
    color: 'rgba(24,20,37,0.45)',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
  },
  card: { marginBottom: spacing.md },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipPress: {},
  chip: { paddingVertical: 10, paddingHorizontal: spacing.lg },
  chipLabel: { ...glassType.label, fontSize: 14, color: light.inkMuted, fontWeight: '600' },
  chipLabelSelected: { color: accents.voice.solid, fontWeight: '700' },

  note: { ...glassType.caption, color: 'rgba(24,20,37,0.55)', lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(24,20,37,0.12)' },
  version: { ...glassType.caption, color: 'rgba(24,20,37,0.5)', textAlign: 'center', marginTop: spacing.md },
});
