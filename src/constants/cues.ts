import type { CueDefinition, CueType } from '@/types';

/**
 * Core cue catalog — sport-agnostic spatial calls.
 * "Man on" is a soccer-flavored example label, not a product-category lock.
 */
export const CUE_CATALOG: readonly CueDefinition[] = [
  {
    id: 'check_left',
    type: 'check_left',
    label: 'Check Left',
    description: 'Shoulder-check over your left side.',
    spokenLabel: 'Check left',
    hudLabel: 'LEFT',
    category: 'check',
    side: 'left',
  },
  {
    id: 'check_right',
    type: 'check_right',
    label: 'Check Right',
    description: 'Shoulder-check over your right side.',
    spokenLabel: 'Check right',
    hudLabel: 'RIGHT',
    category: 'check',
    side: 'right',
  },
  {
    id: 'scan',
    type: 'scan',
    label: 'Scan',
    description: 'Quick head swivel - take in the whole field or court.',
    spokenLabel: 'Scan',
    hudLabel: 'SCAN',
    category: 'scan',
    side: 'none',
  },
  {
    id: 'turn',
    type: 'turn',
    label: 'Turn',
    description: 'Turn and play forward into space.',
    spokenLabel: 'Turn',
    hudLabel: 'TURN',
    category: 'action',
    side: 'none',
  },
  {
    id: 'man_on',
    type: 'man_on',
    label: 'Man On',
    description: 'Pressure incoming - protect the ball and play quick.',
    spokenLabel: 'Man on',
    hudLabel: 'MAN ON',
    category: 'action',
    side: 'none',
  },
  {
    id: 'open_body',
    type: 'open_body',
    label: 'Open Body',
    description: 'Open your hips to receive across your body.',
    spokenLabel: 'Open body',
    hudLabel: 'OPEN',
    category: 'body',
    side: 'none',
  },
] as const;

/** Stable display order for setup / settings / history. */
export const CUE_ORDER: readonly CueType[] = CUE_CATALOG.map((c) => c.id);

export const CUE_BY_ID: Readonly<Record<CueType, CueDefinition>> =
  Object.fromEntries(CUE_CATALOG.map((c) => [c.id, c])) as Record<
    CueType,
    CueDefinition
  >;

export const ALL_CUE_TYPES: readonly CueType[] = [...CUE_ORDER];

export const DEFAULT_ENABLED_CUES: readonly CueType[] = [
  'check_left',
  'check_right',
  'scan',
  'turn',
  'man_on',
  'open_body',
];

export function getCueDefinition(id: CueType): CueDefinition {
  return CUE_BY_ID[id];
}

/** Catalog entries in display order, optionally filtered to an enabled set. */
export function listCues(ids?: readonly CueType[]): CueDefinition[] {
  if (!ids) return [...CUE_CATALOG];
  const enabled = new Set(ids);
  return CUE_ORDER.filter((id) => enabled.has(id)).map((id) => CUE_BY_ID[id]);
}

export function isDirectionalCheck(type: CueType): boolean {
  return type === 'check_left' || type === 'check_right';
}
