import type { CueDefinition, CueId } from '@/types';
import { pick, randomInt, type Rng } from '@/utils/random';

/** Spoken values for the `color` variable cue. Kept short + TTS-friendly. */
export const COLOR_WORDS = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'White',
  'Black',
  'Orange',
] as const;

/** Range for the `number` variable cue (jersey-style numbers). */
export const NUMBER_RANGE = { min: 1, max: 30 } as const;

/**
 * The cue catalog. This is the single source of truth for cue labels, audio
 * phrasing, color-coding, and selection metadata. To add a cue type later,
 * extend the `CueId` union and add an entry here.
 */
export const CUES: Record<CueId, CueDefinition> = {
  check_left: {
    id: 'check_left',
    label: 'Check Left',
    shortLabel: 'Left',
    category: 'direction',
    side: 'left',
    description: 'Shoulder-check over your left side.',
    defaultPhrase: 'Check left',
    speak: () => 'Check left',
    colorToken: 'cueLeft',
  },
  check_right: {
    id: 'check_right',
    label: 'Check Right',
    shortLabel: 'Right',
    category: 'direction',
    side: 'right',
    description: 'Shoulder-check over your right side.',
    defaultPhrase: 'Check right',
    speak: () => 'Check right',
    colorToken: 'cueRight',
  },
  man_on: {
    id: 'man_on',
    label: 'Man On',
    shortLabel: 'Man On',
    category: 'action',
    side: 'none',
    description: 'Pressure incoming — shield the ball, play quick.',
    defaultPhrase: 'Man on',
    speak: () => 'Man on',
    colorToken: 'cueAlert',
  },
  turn: {
    id: 'turn',
    label: 'Turn',
    shortLabel: 'Turn',
    category: 'action',
    side: 'none',
    description: 'Space behind you — turn and drive forward.',
    defaultPhrase: 'Turn',
    speak: () => 'Turn',
    colorToken: 'cueAction',
  },
  scan: {
    id: 'scan',
    label: 'Scan',
    shortLabel: 'Scan',
    category: 'action',
    side: 'none',
    description: 'Quick head-on-a-swivel scan of the whole pitch.',
    defaultPhrase: 'Scan',
    speak: () => 'Scan',
    colorToken: 'cueAction',
  },
  open_body: {
    id: 'open_body',
    label: 'Open Body',
    shortLabel: 'Open',
    category: 'action',
    side: 'none',
    description: 'Open your hips to receive across your body.',
    defaultPhrase: 'Open body',
    speak: () => 'Open body',
    colorToken: 'cueAction',
  },
  color: {
    id: 'color',
    label: 'Color',
    shortLabel: 'Color',
    category: 'variable',
    side: 'none',
    description: 'React to the called color (cone / bib / target).',
    defaultPhrase: 'Color',
    speak: (rng: Rng) => pick(rng, COLOR_WORDS),
    colorToken: 'cueVariableColor',
  },
  number: {
    id: 'number',
    label: 'Number',
    shortLabel: 'Number',
    category: 'variable',
    side: 'none',
    description: 'React to the called number (find the player / target).',
    defaultPhrase: 'Number',
    speak: (rng: Rng) => String(randomInt(rng, NUMBER_RANGE.min, NUMBER_RANGE.max)),
    colorToken: 'cueVariableNumber',
  },
};

/** Stable display order for setup/settings/history. */
export const CUE_ORDER: CueId[] = [
  'check_left',
  'check_right',
  'man_on',
  'turn',
  'scan',
  'open_body',
  'color',
  'number',
];

export const ALL_CUE_IDS: CueId[] = [...CUE_ORDER];

export function getCue(id: CueId): CueDefinition {
  return CUES[id];
}

export function listCues(ids: CueId[]): CueDefinition[] {
  return CUE_ORDER.filter((id) => ids.includes(id)).map((id) => CUES[id]);
}

/** Resolve the phrase to speak for a cue (handles variable cues). */
export function resolveCuePhrase(id: CueId, rng: Rng): string {
  return CUES[id].speak(rng);
}
