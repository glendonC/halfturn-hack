/**
 * HalfTurn visual tokens — night-pitch training feel for live drills.
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

  // Aliases used by camera chrome + immersive layouts
  background: '#0B1F17',
  backgroundDeep: '#07140F',
  borderStrong: '#3A6B58',
  textPrimary: '#F2F7F4',
  textSecondary: '#9BB5AA',
  primary: '#C8F542',
  success: '#34D399',
  warning: '#FACC15',

  // Cue color-coding (glass chips / distribution accents)
  cueLeft: '#22D3EE',
  cueRight: '#FB923C',
  cueAction: '#A3E635',
  cueAlert: '#FB7185',
  cueVariableColor: '#C084FC',
  cueVariableNumber: '#FACC15',
  cueNeutral: '#C8F542',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 } as const;

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
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
