import { colors, palette } from './colors';
import { accents, bloom, glass, glassRadius, glassTheme, glassType, glow, light } from './glass';
import { motion } from './motion';
import { hitSlop, radius, spacing } from './spacing';
import { fontFamily, fontSize, fontWeight, typography } from './typography';

export const theme = {
  colors,
  palette,
  spacing,
  radius,
  hitSlop,
  typography,
  fontFamily,
  fontSize,
  fontWeight,
  // Liquid Glass (light) language.
  glass,
  glassType,
  glassRadius,
  glow,
  accents,
  bloom,
  light,
  motion,
} as const;

export type Theme = typeof theme;

export { colors, palette } from './colors';
export { spacing, radius, hitSlop } from './spacing';
export { typography, fontFamily, fontSize, fontWeight } from './typography';
export { light, glass, glassRadius, glow, accents, bloom, glassType, glassTheme, underglowSecondary } from './glass';
export { motion, animateNext, duration as motionDuration, layoutPresets } from './motion';
export type { ColorToken } from './colors';
export type { TypographyVariant } from './typography';
export type { AccentKey } from './glass';
