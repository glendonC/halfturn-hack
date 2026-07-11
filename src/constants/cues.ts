import type { CueDefinition, CueType } from '@/types';

/**
 * Core cue catalog — sport-agnostic spatial calls.
 * "Man on" is a soccer-flavored example label, not a product-category lock.
 */
export const CUE_CATALOG: readonly CueDefinition[] = [
  {
    id: 'check_left',
    type: 'check_left',
    spokenLabel: 'Check left',
    hudLabel: 'LEFT',
    category: 'check',
    side: 'left',
  },
  {
    id: 'check_right',
    type: 'check_right',
    spokenLabel: 'Check right',
    hudLabel: 'RIGHT',
    category: 'check',
    side: 'right',
  },
  {
    id: 'scan',
    type: 'scan',
    spokenLabel: 'Scan',
    hudLabel: 'SCAN',
    category: 'scan',
    side: 'none',
  },
  {
    id: 'turn',
    type: 'turn',
    spokenLabel: 'Turn',
    hudLabel: 'TURN',
    category: 'action',
    side: 'none',
  },
  {
    id: 'man_on',
    type: 'man_on',
    spokenLabel: 'Man on',
    hudLabel: 'MAN ON',
    category: 'action',
    side: 'none',
  },
  {
    id: 'open_body',
    type: 'open_body',
    spokenLabel: 'Open body',
    hudLabel: 'OPEN',
    category: 'body',
    side: 'none',
  },
] as const;

export const CUE_BY_ID: Readonly<Record<CueType, CueDefinition>> =
  Object.fromEntries(CUE_CATALOG.map((c) => [c.id, c])) as Record<
    CueType,
    CueDefinition
  >;

export const ALL_CUE_TYPES: readonly CueType[] = CUE_CATALOG.map((c) => c.type);

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

export function isDirectionalCheck(type: CueType): boolean {
  return type === 'check_left' || type === 'check_right';
}
