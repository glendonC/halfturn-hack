import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CUE_CATALOG, DURATION_PRESETS_MS } from '@/constants';
import { useDrillStore, useSettingsStore } from '@/state';
import { colors, spacing, typography } from '@/theme';
import type { CueType, DrillMode } from '@/types';

const BALANCE_PRESETS = [
  { label: 'Left', value: 0.7 },
  { label: 'Even', value: 0.5 },
  { label: 'Right', value: 0.3 },
] as const;

const INTERVAL_STEP_MS = 500;

export function DrillSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = useDrillStore((s) => s.config);
  const setConfig = useDrillStore((s) => s.setConfig);
  const startCountdown = useDrillStore((s) => s.startCountdown);
  const testSound = useDrillStore((s) => s.testSound);
  const patchDrillDefaults = useSettingsStore((s) => s.patchDrillDefaults);

  const durationPreset = useMemo(() => {
    const match = (
      Object.entries(DURATION_PRESETS_MS) as [string, number][]
    ).find(([, ms]) => ms === config.durationMs);
    return match?.[0] ?? 'custom';
  }, [config.durationMs]);

  const durationMinutes = Math.round(config.durationMs / 60_000);

  function toggleCue(type: CueType) {
    const enabled = new Set(config.enabledCues);
    if (enabled.has(type)) {
      if (enabled.size <= 1) return;
      enabled.delete(type);
    } else {
      enabled.add(type);
    }
    setConfig({ enabledCues: [...enabled] });
  }

  function bumpInterval(
    key: 'min' | 'max',
    delta: number,
  ) {
    const next = {
      min: config.intervalMs.min,
      max: config.intervalMs.max,
      [key]: Math.max(1000, config.intervalMs[key] + delta),
    };
    if (next.min > next.max) {
      if (key === 'min') next.max = next.min;
      else next.min = next.max;
    }
    setConfig({ intervalMs: next });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={styles.brand}>HalfTurn</Text>
      <Text style={styles.title}>Train</Text>
      <Text style={styles.subtitle}>
        Solo scanning drill — headphones on, eyes up.
      </Text>

      <Section title="Duration">
        <View style={styles.rowWrap}>
          {(
            [
              ['short', '1 min'],
              ['standard', '3 min'],
              ['long', '5 min'],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              active={durationPreset === key}
              onPress={() => setConfig({ durationMs: DURATION_PRESETS_MS[key] })}
            />
          ))}
        </View>
        <View style={styles.customRow}>
          <Text style={styles.hint}>Custom (minutes)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(durationMinutes)}
            onChangeText={(text) => {
              const n = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
              if (!Number.isFinite(n) || n <= 0) return;
              setConfig({ durationMs: Math.min(30, n) * 60_000 });
            }}
          />
        </View>
      </Section>

      <Section title="Cue interval">
        <Stepper
          label={`Min ${ (config.intervalMs.min / 1000).toFixed(1) }s`}
          onMinus={() => bumpInterval('min', -INTERVAL_STEP_MS)}
          onPlus={() => bumpInterval('min', INTERVAL_STEP_MS)}
        />
        <Stepper
          label={`Max ${ (config.intervalMs.max / 1000).toFixed(1) }s`}
          onMinus={() => bumpInterval('max', -INTERVAL_STEP_MS)}
          onPlus={() => bumpInterval('max', INTERVAL_STEP_MS)}
        />
      </Section>

      <Section title="Cues">
        <View style={styles.rowWrap}>
          {CUE_CATALOG.map((cue) => (
            <Chip
              key={cue.id}
              label={cue.label}
              active={config.enabledCues.includes(cue.id)}
              onPress={() => toggleCue(cue.id)}
            />
          ))}
        </View>
      </Section>

      <Section title="Blind-side balance">
        <View style={styles.rowWrap}>
          {BALANCE_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              active={Math.abs(config.leftRightBalance - preset.value) < 0.05}
              onPress={() => setConfig({ leftRightBalance: preset.value })}
            />
          ))}
        </View>
        <Text style={styles.hint}>
          Biases check-left vs check-right. Even = 50/50 target.
        </Text>
      </Section>

      <Section title="Countdown">
        <View style={styles.rowWrap}>
          {(
            [
              [0, 'Off'],
              [3, '3s'],
              [5, '5s'],
            ] as const
          ).map(([sec, label]) => (
            <Chip
              key={label}
              label={label}
              active={config.countdownSec === sec}
              onPress={() => setConfig({ countdownSec: sec })}
            />
          ))}
        </View>
      </Section>

      <Section title="Session">
        <ToggleRow
          label="Spoken countdown"
          value={config.spokenCountdown}
          onValueChange={(spokenCountdown) => setConfig({ spokenCountdown })}
        />
        <ToggleRow
          label="Haptics on cues"
          value={config.haptics}
          onValueChange={(haptics) => setConfig({ haptics })}
        />
        <ToggleRow
          label="Avoid repeating last cue"
          value={config.avoidLastN > 0}
          onValueChange={(on) => setConfig({ avoidLastN: on ? 1 : 0 })}
        />
        <Text style={[styles.hint, { marginTop: spacing.sm }]}>Mode</Text>
        <View style={styles.rowWrap}>
          {(
            [
              ['audio', 'Audio'],
              ['turn_react', 'Turn & React'],
            ] as const satisfies readonly (readonly [DrillMode, string])[]
          ).map(([mode, label]) => (
            <Chip
              key={mode}
              label={label}
              active={config.mode === mode}
              onPress={() => setConfig({ mode })}
            />
          ))}
        </View>
        {config.mode === 'turn_react' && (
          <Text style={styles.hint}>
            Preview: on-screen cues + beep, no camera. Verification stays null
            (NullPoseVerifier).
          </Text>
        )}
        <Text style={[styles.hint, { marginTop: spacing.sm }]}>
          Voice rate / pitch live in Settings and apply to the next drill.
        </Text>
      </Section>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        onPress={() => {
          void patchDrillDefaults(config).finally(() => {
            startCountdown();
            router.push('/drill/active');
          });
        }}
      >
        <Text style={styles.primaryBtnText}>Start drill</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        onPress={() => void testSound()}
      >
        <Text style={styles.secondaryBtnText}>Test sound</Text>
      </Pressable>
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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  brand: {
    ...typography.caption,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hint: { ...typography.body, color: colors.textMuted, fontSize: 14 },
  input: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
  },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { color: colors.text, fontSize: 16, fontWeight: '500' },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.88 },
});
