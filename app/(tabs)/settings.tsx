import { useState, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CUE_CATALOG, DURATION_PRESETS_MS } from '@/constants';
import { getDrillAudioEngine, useSettingsStore } from '@/state';
import { colors, spacing, typography } from '@/theme';

const RATE_PRESETS = [
  { label: 'Slow', value: 0.85 },
  { label: 'Normal', value: 1 },
  { label: 'Fast', value: 1.15 },
] as const;

const PITCH_PRESETS = [
  { label: 'Low', value: 0.9 },
  { label: 'Mid', value: 1 },
  { label: 'High', value: 1.15 },
] as const;

const VOLUME_PRESETS = [
  { label: 'Low', value: 0.5 },
  { label: 'Med', value: 0.75 },
  { label: 'Max', value: 1 },
] as const;

const INTERVAL_STEP_MS = 500;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((s) => s.settings);
  const patchAudio = useSettingsStore((s) => s.patchAudio);
  const patchDrillDefaults = useSettingsStore((s) => s.patchDrillDefaults);
  const setKeepAwakeDefault = useSettingsStore((s) => s.setKeepAwakeDefault);
  const toggleDefaultCue = useSettingsStore((s) => s.toggleDefaultCue);
  const clearHistory = useSettingsStore((s) => s.clearHistory);
  const [clearing, setClearing] = useState(false);

  const durationPreset = (
    Object.entries(DURATION_PRESETS_MS) as [string, number][]
  ).find(([, ms]) => ms === settings.drill.durationMs)?.[0] ?? 'custom';

  function bumpInterval(key: 'min' | 'max', delta: number) {
    const next = {
      min: settings.drill.intervalMs.min,
      max: settings.drill.intervalMs.max,
      [key]: Math.max(1000, settings.drill.intervalMs[key] + delta),
    };
    if (next.min > next.max) {
      if (key === 'min') next.max = next.min;
      else next.min = next.max;
    }
    void patchDrillDefaults({ intervalMs: next });
  }

  function confirmClear() {
    Alert.alert(
      'Clear history?',
      'This soft-deletes all local sessions on this device. It cannot be undone in-app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearing(true);
              try {
                await clearHistory();
              } finally {
                setClearing(false);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Defaults for Train. Stored on-device only.
      </Text>

      <Section title="Voice">
        <Text style={styles.hint}>
          Prefer headphones on the field. Device Silent switch is handled for
          cues — still turn media volume up.
        </Text>
        <Label>Volume (web TTS; native uses hardware volume)</Label>
        <PresetRow
          presets={VOLUME_PRESETS}
          value={settings.audio.volume}
          onSelect={(volume) => void patchAudio({ volume })}
        />
        <Label>Speech rate</Label>
        <PresetRow
          presets={RATE_PRESETS}
          value={settings.audio.rate}
          onSelect={(rate) => void patchAudio({ rate })}
        />
        <Label>Pitch</Label>
        <PresetRow
          presets={PITCH_PRESETS}
          value={settings.audio.pitch}
          onSelect={(pitch) => void patchAudio({ pitch })}
        />
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            getDrillAudioEngine().setOptions(settings.audio);
            void getDrillAudioEngine().testSound();
          }}
        >
          <Text style={styles.secondaryBtnText}>Test sound</Text>
        </Pressable>
      </Section>

      <Section title="Drill defaults">
        <Label>Duration</Label>
        <View style={styles.rowWrap}>
          {(
            [
              ['short', '1 min'],
              ['standard', '3 min'],
              ['long', '5 min'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() =>
                void patchDrillDefaults({ durationMs: DURATION_PRESETS_MS[key] })
              }
              style={[
                styles.chip,
                durationPreset === key && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  durationPreset === key && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Label>Cue interval</Label>
        <Stepper
          label={`Min ${(settings.drill.intervalMs.min / 1000).toFixed(1)}s`}
          onMinus={() => bumpInterval('min', -INTERVAL_STEP_MS)}
          onPlus={() => bumpInterval('min', INTERVAL_STEP_MS)}
        />
        <Stepper
          label={`Max ${(settings.drill.intervalMs.max / 1000).toFixed(1)}s`}
          onMinus={() => bumpInterval('max', -INTERVAL_STEP_MS)}
          onPlus={() => bumpInterval('max', INTERVAL_STEP_MS)}
        />
        <Label>Countdown</Label>
        <View style={styles.rowWrap}>
          {(
            [
              [0, 'Off'],
              [3, '3s'],
              [5, '5s'],
            ] as const
          ).map(([sec, label]) => (
            <Pressable
              key={label}
              onPress={() => void patchDrillDefaults({ countdownSec: sec })}
              style={[
                styles.chip,
                settings.drill.countdownSec === sec && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.drill.countdownSec === sec && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <ToggleRow
          label="Haptics on cues"
          value={settings.drill.haptics}
          onValueChange={(haptics) => void patchDrillDefaults({ haptics })}
        />
        <ToggleRow
          label="Spoken countdown"
          value={settings.drill.spokenCountdown}
          onValueChange={(spokenCountdown) =>
            void patchDrillDefaults({ spokenCountdown })
          }
        />
        <ToggleRow
          label="Keep screen awake in drills"
          value={settings.keepAwakeDefault}
          onValueChange={(v) => void setKeepAwakeDefault(v)}
        />
      </Section>

      <Section title="Default cue mix">
        <View style={styles.rowWrap}>
          {CUE_CATALOG.map((cue) => {
            const active = settings.drill.enabledCues.includes(cue.id);
            return (
              <Pressable
                key={cue.id}
                onPress={() => void toggleDefaultCue(cue.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cue.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Data">
        <Pressable
          style={[styles.dangerBtn, clearing && styles.disabled]}
          disabled={clearing}
          onPress={confirmClear}
        >
          <Text style={styles.dangerBtnText}>
            {clearing ? 'Clearing…' : 'Clear history'}
          </Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function PresetRow({
  presets,
  value,
  onSelect,
}: {
  presets: readonly { label: string; value: number }[];
  value: number;
  onSelect: (v: number) => void;
}) {
  return (
    <View style={styles.rowWrap}>
      {presets.map((p) => {
        const active = Math.abs(value - p.value) < 0.02;
        return (
          <Pressable
            key={p.label}
            onPress={() => onSelect(p.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable onPress={onPlus} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.xs },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.bg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { color: colors.text, fontSize: 16, fontWeight: '500', flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  stepperLabel: { color: colors.text, fontWeight: '600', fontSize: 16 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  stepBtnText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  secondaryBtn: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textMuted, fontWeight: '700' },
  dangerBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerBtnText: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
