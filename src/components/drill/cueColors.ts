import type { CueCategory } from '@/types';

/** Strong full-bleed floods for eyes-free cue recognition — not purple. */
export const CUE_CATEGORY_FLOOD: Record<
  CueCategory,
  { bg: string; text: string; label: string }
> = {
  check: { bg: '#0A4D8C', text: '#F2F7F4', label: 'CHECK' },
  scan: { bg: '#1F6B3A', text: '#C8F542', label: 'SCAN' },
  action: { bg: '#8C1F18', text: '#FFD6D1', label: 'REACT' },
  body: { bg: '#8A5A00', text: '#FFE6A8', label: 'BODY' },
  variable: { bg: '#4A2C6A', text: '#E8D6FF', label: 'CALL' },
};

export const HUD_NEUTRAL = {
  bg: '#0B1F17',
  text: '#F2F7F4',
  muted: '#9BB5AA',
  accent: '#C8F542',
  danger: '#F07167',
  surface: 'rgba(0,0,0,0.25)',
} as const;

export const COUNTDOWN_FLOOD = {
  bg: '#102820',
  text: '#C8F542',
} as const;
