/**
 * HalfTurn visual tokens — night-pitch training feel.
 * Avoid default AI palettes (purple gradients, cream+terracotta, etc.).
 */
export const colors = {
  bg: '#0B1F17',
  bgElevated: '#123028',
  surface: '#1A3D32',
  border: '#2A5648',
  text: '#F2F7F4',
  textMuted: '#9BB5AA',
  accent: '#C8F542',
  accentDim: '#8FB82E',
  danger: '#F07167',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  brand: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
} as const;

export const theme = { colors, spacing, typography } as const;
