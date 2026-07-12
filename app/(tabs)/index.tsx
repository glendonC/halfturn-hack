import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassChoiceCard,
  GlassCluster,
  GlassCueChip,
  GlassRailItem,
  GlassScreen,
  GlassSegmented,
  GlassSlider,
  GlassSurface,
  GlassToggleRow,
  GradientSquircle,
  HeroBackdrop,
  Icon,
  Icons,
  type IconComponent,
} from '@/components/glass';
import { CUES } from '@/constants/cues';
import { DURATION_BOUNDS, DURATION_PRESETS, INTERVAL_BOUNDS } from '@/constants/defaults';
import { VISION_ENABLED } from '@/services/vision';
import { useDrillConfigStore } from '@/state/useDrillConfigStore';
import { useProfile } from '@/state/useProfileStore';
import { useSettings } from '@/state/useSettingsStore';
import { accents, animateNext, glass, glassRadius, glassType, glow, light, spacing, type AccentKey } from '@/theme';
import { formatDuration, formatSeconds, pluralize } from '@/utils/format';

const NAV_CLEARANCE = 88;

type SectionKey = 'mode' | 'duration' | 'interval' | 'cues' | 'balance' | 'options';

interface Section {
  key: SectionKey;
  icon: IconComponent;
  title: string;
}

const SECTIONS: Section[] = [
  { key: 'mode', icon: Icons.Target, title: 'Mode' },
  { key: 'duration', icon: Icons.Timer, title: 'Duration' },
  { key: 'interval', icon: Icons.Repeat, title: 'Cue interval' },
  { key: 'cues', icon: Icons.MessageSquareText, title: 'Cue types' },
  { key: 'balance', icon: Icons.Activity, title: 'Left / right balance' },
  { key: 'options', icon: Icons.Settings2, title: 'Options' },
];

/** Each customization section themes the screen in its own accent when open. */
const SECTION_ACCENT: Record<SectionKey, AccentKey> = {
  mode: 'home',
  duration: 'field',
  interval: 'voice',
  cues: 'vocab',
  balance: 'feedback',
  options: 'audio',
};

/** A run of the session brief: plain connective copy, or a tappable parameter. */
type BriefSeg =
  | { t: 'text'; s: string }
  | { t: 'token'; key: SectionKey; s: string; trail?: string; warn?: boolean };

/** Time-of-day greeting for the default (nothing-selected) Home state. */
function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * A launcher pill, styled like the bottom nav: always a glass body (so adjacent
 * pills fluid-merge in the cluster), with a dark inset for the live/`selected`
 * action and a quiet muted state otherwise. `disabled` greys it and blocks taps.
 */
function LaunchPill({
  label,
  icon,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconComponent;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => [styles.launchShadow, glow.floating, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <GlassSurface radius={glassRadius.squircle} intensity="regular" fill={glass.fill} style={styles.launchGlass}>
        {selected ? <View style={styles.launchSelected} pointerEvents="none" /> : null}
        <Icon icon={icon} size={20} color={selected ? light.white : light.inkMuted} strokeWidth={2} />
        <Text style={[styles.launchLabel, { color: selected ? light.white : light.inkSoft }]}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

export default function TrainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const profile = useProfile();
  const config = useDrillConfigStore((s) => s.config);
  const setConfig = useDrillConfigStore((s) => s.setConfig);
  const toggleCue = useDrillConfigStore((s) => s.toggleCue);
  const setInterval = useDrillConfigStore((s) => s.setInterval);
  // null = default state: greet the player and summarize session readiness.
  const [active, setActive] = useState<SectionKey | null>(null);

  // Return to the greeting each time Home regains focus (e.g. after a drill).
  useFocusEffect(useCallback(() => setActive(null), []));

  const vocab = settings.enabledVocabulary;
  const isTurnReact = config.mode === 'turn-react';
  const current = active ? SECTIONS.find((s) => s.key === active)! : null;
  // Base mood follows the mode; while editing a section, the whole screen takes
  // that section's accent so its squircle, underglow, and backdrop theme together.
  const modeAccent: AccentKey = isTurnReact ? 'home' : 'audio';
  const accent: AccentKey = current ? SECTION_ACCENT[current.key] : modeAccent;

  const activeCueCount = config.enabledCues.filter((c) => vocab.includes(c)).length;
  const canStart = activeCueCount > 0;
  const rightPct = Math.round(config.leftRightBalance * 100);
  const greeting = greetingFor(new Date().getHours());

  const select = (key: SectionKey) => {
    animateNext();
    // Tapping the selected pill again returns to the default greeting.
    setActive((prev) => (prev === key ? null : key));
  };

  const goToProfile = () => router.navigate('/profile');

  // Turn & React needs a camera-framing step first; audio starts the session directly.
  const needsCamera = isTurnReact && VISION_ENABLED;
  const goActive = () => router.push('/drill/active');
  const goFraming = () => router.push('/drill/framing');

  const sectionValue = (key: SectionKey): string => {
    switch (key) {
      case 'mode':
        return isTurnReact ? 'Turn & react' : 'Spoken cues';
      case 'duration':
        return `${Math.round(config.durationSec / 60)}m`;
      case 'interval':
        return `${formatSeconds(config.intervalMinSec)}–${formatSeconds(config.intervalMaxSec)}`;
      case 'cues':
        return String(activeCueCount);
      case 'balance':
        return `${100 - rightPct}/${rightPct}`;
      case 'options':
        return String((config.countdownEnabled ? 1 : 0) + (config.avoidImmediateRepeat ? 1 : 0));
    }
  };

  // Coach briefing. Tokens stay tappable; connective copy carries the meaning.
  const secLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const durationMins = Math.round(config.durationSec / 60);
  const durationText = pluralize(durationMins, 'minute');
  const intervalText =
    config.intervalMinSec === config.intervalMaxSec
      ? `${secLabel(config.intervalMinSec)} seconds`
      : `${secLabel(config.intervalMinSec)} to ${secLabel(config.intervalMaxSec)} seconds`;

  const evenBalance = rightPct === 50;
  const favorSide = rightPct > 50 ? 'right' : 'left';
  const balanceText = evenBalance
    ? 'evenly left and right'
    : rightPct === 0 || rightPct === 100
      ? `only your ${favorSide}`
      : `mostly your ${favorSide}`;

  const cueSegs: BriefSeg[] =
    activeCueCount > 0
      ? [
          { t: 'text', s: 'from' },
          { t: 'token', key: 'cues', s: pluralize(activeCueCount, 'cue type'), trail: ',' },
        ]
      : [
          { t: 'text', s: 'from' },
          { t: 'token', key: 'cues', s: 'no cues yet', trail: ',', warn: true },
        ];

  const brief: BriefSeg[] = [
    { t: 'text', s: 'A' },
    { t: 'token', key: 'mode', s: isTurnReact ? 'turn and react' : 'spoken cues' },
    { t: 'text', s: 'session for' },
    { t: 'token', key: 'duration', s: durationText, trail: '.' },
    { t: 'text', s: 'A new cue every' },
    { t: 'token', key: 'interval', s: intervalText, trail: ',' },
    ...cueSegs,
    { t: 'token', key: 'balance', s: balanceText, trail: '.' },
  ];

  return (
    <GlassScreen transitionOnFocus accent={accent} contentStyle={{ paddingBottom: insets.bottom + NAV_CLEARANCE }}>
      <View style={styles.frame}>
        {/* Ambient dot-field + light sweep, tinted to the active section, behind the hero. */}
        <HeroBackdrop accent={accent} style={styles.backdrop} />

        {/* Session launcher, top-left. "Start Session" is the goal; when a step is
            required (camera framing) it greys out and a connected chip shows the step. */}
        <View style={styles.launchArea}>
          <GlassCluster spacing={20} style={styles.launchRow}>
            {needsCamera ? (
              <>
                <LaunchPill label="Start Session" icon={Icons.Play} selected={false} disabled />
                <LaunchPill label="Set up camera" icon={Icons.Camera} selected={canStart} disabled={!canStart} onPress={goFraming} />
              </>
            ) : (
              <LaunchPill label="Start Session" icon={Icons.Play} selected={canStart} disabled={!canStart} onPress={goActive} />
            )}
          </GlassCluster>
        </View>

        <View style={styles.mid}>
          <View style={styles.left}>
            <View style={styles.brow}>
              <Text style={styles.eyebrow}>{current ? current.title : greeting}</Text>
              <View style={styles.browLine} />
            </View>
            {current ? (
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {sectionValue(current.key)}
              </Text>
            ) : (
              <Pressable onPress={goToProfile} accessibilityRole="button" accessibilityLabel="Edit your name">
                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {profile.displayName ?? 'Player'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.strip}>
            {SECTIONS.map((s) => (
              <GlassRailItem
                key={s.key}
                icon={s.icon}
                accent={SECTION_ACCENT[s.key]}
                selected={s.key === active}
                onPress={() => select(s.key)}
                accessibilityLabel={s.title}
              />
            ))}
          </View>
        </View>

        <GradientSquircle accent={accent} style={styles.squircle}>
          <View style={styles.sqPad}>
            {current ? <Text style={styles.sqOverline}>{current.title}</Text> : null}
            <View style={styles.sqBody}>
              {current ? (
                renderSection(current.key, { config, setConfig, toggleCue, setInterval, vocab, accent })
              ) : (
                <SessionBrief brief={brief} onSelect={select} />
              )}
            </View>
          </View>
        </GradientSquircle>
      </View>
    </GlassScreen>
  );
}

interface SectionCtx {
  config: ReturnType<typeof useDrillConfigStore.getState>['config'];
  setConfig: ReturnType<typeof useDrillConfigStore.getState>['setConfig'];
  toggleCue: ReturnType<typeof useDrillConfigStore.getState>['toggleCue'];
  setInterval: ReturnType<typeof useDrillConfigStore.getState>['setInterval'];
  vocab: ReturnType<typeof useSettings>['enabledVocabulary'];
  accent: AccentKey;
}

function Divider() {
  return <View style={styles.divider} />;
}

/** Accent hex blended toward white by `t` (0..1) — a pale, legible highlight fill. */
function tintChip(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const BRIEF_FONT_MIN = 18;
const BRIEF_FONT_MAX = 34;

/**
 * Session brief that scales its type to fill the squircle. `adjustsFontSizeToFit`
 * can't handle mixed Text + pressable tokens, so we measure the wrap and step the
 * font down from a large max until the copy fits the available height.
 */
function SessionBrief({
  brief,
  onSelect,
}: {
  brief: BriefSeg[];
  onSelect: (key: SectionKey) => void;
}) {
  const [areaH, setAreaH] = useState(0);
  const [fontSize, setFontSize] = useState(BRIEF_FONT_MAX);
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const briefKey = brief
    .map((seg) => (seg.t === 'text' ? seg.s : `${seg.key}:${seg.s}:${seg.trail ?? ''}:${seg.warn ? 1 : 0}`))
    .join('|');

  // Fresh max whenever the copy or the box height changes; onLayout shrinks to fit.
  useEffect(() => {
    setFontSize(BRIEF_FONT_MAX);
  }, [briefKey, areaH]);

  const lineHeight = Math.round(fontSize * 1.3);
  const gap = Math.max(4, Math.round(fontSize * 0.22));
  const textStyle = [styles.briefText, { fontSize, lineHeight }];

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== areaH) setAreaH(h);
  };

  const onBriefLayout = (e: LayoutChangeEvent) => {
    if (!areaH) return;
    const contentH = e.nativeEvent.layout.height;
    if (contentH <= areaH + 2) return;
    const current = fontSizeRef.current;
    const next = Math.max(BRIEF_FONT_MIN, Math.floor(current * (areaH / contentH) * 0.96));
    if (next < current) setFontSize(next);
  };

  return (
    <View style={styles.briefArea} onLayout={onAreaLayout}>
      {/* Remount when the box size arrives so onLayout runs with a known areaH. */}
      <View
        key={`${briefKey}:${areaH}`}
        style={[styles.brief, { columnGap: gap, rowGap: gap }]}
        onLayout={onBriefLayout}
      >
        {brief.map((seg, i) =>
          seg.t === 'text' ? (
            seg.s.split(' ').map((w, j) => (
              <Text key={`t${i}-${j}`} style={textStyle}>
                {w}
              </Text>
            ))
          ) : (
            <ParamToken
              key={`k${i}`}
              value={seg.s}
              trail={seg.trail}
              accent={SECTION_ACCENT[seg.key]}
              warn={seg.warn}
              label={SECTIONS.find((s) => s.key === seg.key)!.title}
              fontSize={fontSize}
              lineHeight={lineHeight}
              onPress={() => onSelect(seg.key)}
            />
          ),
        )}
      </View>
    </View>
  );
}

/**
 * One highlighted parameter inside the session brief. The value keeps the ink
 * color of the surrounding prose; only a soft, section-tinted squircle highlight
 * sits behind it (coral when it flags an unready setting). Trailing punctuation
 * hugs it so the sentence still reads as prose. Tapping opens that section's editor.
 */
function ParamToken({
  value,
  trail,
  accent,
  warn,
  label,
  fontSize,
  lineHeight,
  onPress,
}: {
  value: string;
  trail?: string;
  accent: AccentKey;
  warn?: boolean;
  label: string;
  fontSize: number;
  lineHeight: number;
  onPress: () => void;
}) {
  const base = warn ? accents.data.solid : accents[accent].solid;
  const textStyle = [styles.briefText, { fontSize, lineHeight }];
  const padV = Math.max(1, Math.round(fontSize * 0.06));
  const padH = Math.max(6, Math.round(fontSize * 0.28));
  return (
    <View style={styles.tokenWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => [
          styles.token,
          { backgroundColor: tintChip(base, warn ? 0.74 : 0.82), paddingVertical: padV, paddingHorizontal: padH },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={textStyle}>{value}</Text>
      </Pressable>
      {trail ? <Text style={textStyle}>{trail}</Text> : null}
    </View>
  );
}

function renderSection(key: SectionKey, ctx: SectionCtx) {
  const { config, setConfig, toggleCue, setInterval, vocab, accent } = ctx;
  switch (key) {
    case 'mode':
      return (
        <View style={styles.choices}>
          <GlassChoiceCard
            icon={Icons.Headphones}
            title="Spoken cues"
            description="Heard through your headphones. Eyes up, react to each call."
            selected={config.mode === 'audio'}
            accent={accent}
            onPress={() => setConfig({ mode: 'audio' })}
          />
          <GlassChoiceCard
            icon={Icons.Camera}
            title="Turn & react"
            description="Phone propped nearby. Half-turn to read each cue on screen."
            selected={config.mode === 'turn-react'}
            accent={accent}
            onPress={() => setConfig({ mode: 'turn-react' })}
          />
        </View>
      );
    case 'duration':
      return (
        <>
          <GlassSegmented<number>
            options={DURATION_PRESETS.map((sec) => ({ label: `${Math.round(sec / 60)}m`, value: sec }))}
            value={config.durationSec}
            onChange={(sec) => setConfig({ durationSec: sec })}
            accent={accent}
          />
          <GlassSlider
            label="Custom length"
            value={config.durationSec}
            min={DURATION_BOUNDS.min}
            max={DURATION_BOUNDS.max}
            step={DURATION_BOUNDS.step}
            valueLabel={formatDuration(config.durationSec)}
            accent={accent}
            onValueChange={(v) => setConfig({ durationSec: Math.round(v) })}
          />
        </>
      );
    case 'interval':
      return (
        <>
          <GlassSlider
            label="Minimum"
            value={config.intervalMinSec}
            min={INTERVAL_BOUNDS.min}
            max={INTERVAL_BOUNDS.max}
            step={INTERVAL_BOUNDS.step}
            valueLabel={formatSeconds(config.intervalMinSec)}
            accent={accent}
            onValueChange={(v) => setInterval(v, config.intervalMaxSec)}
          />
          <GlassSlider
            label="Maximum"
            value={config.intervalMaxSec}
            min={INTERVAL_BOUNDS.min}
            max={INTERVAL_BOUNDS.max}
            step={INTERVAL_BOUNDS.step}
            valueLabel={formatSeconds(config.intervalMaxSec)}
            accent={accent}
            onValueChange={(v) => setInterval(config.intervalMinSec, v)}
          />
        </>
      );
    case 'cues':
      return (
        <View style={styles.chips}>
          {vocab.map((id) => (
            <GlassCueChip
              key={id}
              cue={CUES[id]}
              selected={config.enabledCues.includes(id)}
              onToggle={toggleCue}
            />
          ))}
        </View>
      );
    case 'balance':
      return (
        <GlassSlider
          label="Bias"
          value={config.leftRightBalance}
          min={0}
          max={1}
          step={0.05}
          valueLabel={`L ${100 - Math.round(config.leftRightBalance * 100)}%  ·  R ${Math.round(config.leftRightBalance * 100)}%`}
          accent={accent}
          onValueChange={(v) => setConfig({ leftRightBalance: v })}
        />
      );
    case 'options':
      return (
        <>
          <GlassToggleRow
            label="Spoken countdown"
            description="3-2-1 before the first cue."
            value={config.countdownEnabled}
            onValueChange={(v) => setConfig({ countdownEnabled: v })}
            accent={accent}
          />
          <Divider />
          <GlassToggleRow
            label="Avoid immediate repeats"
            description="Don't fire the same cue twice in a row."
            value={config.avoidImmediateRepeat}
            onValueChange={(v) => setConfig({ avoidImmediateRepeat: v })}
            accent={accent}
          />
        </>
      );
  }
}

const styles = StyleSheet.create({
  frame: { flex: 1 },

  // Ambient backdrop, capped to the top ~two-thirds so it sits behind the hero
  // (greeting + name) and never behind the opaque squircle below it.
  backdrop: { bottom: '34%' },

  // Session launcher, docked top-left. Styled like the bottom nav: glass pills that
  // fluid-merge, with a dark inset for the live action (mirrors the nav's selected disc).
  launchArea: { alignItems: 'flex-start', paddingTop: spacing.xs, paddingBottom: spacing.md },
  launchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  launchShadow: { borderRadius: glassRadius.squircle },
  launchGlass: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.xl },
  launchSelected: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: glassRadius.squircle - 4,
    borderCurve: 'continuous',
    backgroundColor: light.ink,
  },
  launchLabel: { ...glassType.label, fontSize: 16, fontWeight: '600' },

  mid: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingBottom: spacing.md },
  left: { flex: 1, justifyContent: 'flex-end' },
  brow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { ...glassType.overline, color: light.inkSoft },
  browLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(24,20,37,0.18)' },
  value: { ...glassType.hero, fontSize: 68, lineHeight: 72, color: light.ink },
  strip: { justifyContent: 'flex-end', gap: spacing.sm },

  // A stable, fixed-height card so switching sections doesn't resize/shift the
  // layout. Every section's content fits inside with headroom, so centering the
  // body never overflows up into the overline.
  squircle: { height: 280 },
  sqPad: { flex: 1, padding: spacing.xl, gap: spacing.md },
  sqOverline: { ...glassType.overline, color: 'rgba(24,20,37,0.5)' },
  sqBody: { flex: 1, justifyContent: 'center', gap: spacing.md },

  // Default state: coach brief scales to fill this area; tokens stay inline highlights.
  briefArea: { flex: 1, justifyContent: 'center' },
  brief: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  briefText: { ...glassType.body, fontWeight: '500', color: light.ink },
  tokenWrap: { flexDirection: 'row', alignItems: 'center' },
  token: { borderRadius: 9, borderCurve: 'continuous' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choices: { gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(24,20,37,0.12)' },
});
