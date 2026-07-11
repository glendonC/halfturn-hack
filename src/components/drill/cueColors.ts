import type { CueCategory } from '@/types';

/** Strong full-bleed floods for eyes-free cue recognition. */
export const CUE_CATEGORY_FLOOD: Record<
  CueCategory,
  { bg: string; text: string; label: string }
> = {
  direction: { bg: '#0A4D8C', text: '#F2F7F4', label: 'CHECK' },
  action: { bg: '#8C1F18', text: '#FFD6D1', label: 'REACT' },
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
