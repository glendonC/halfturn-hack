import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { light } from '@/theme';

interface CueSurfaceProps {
  /** The cue content that reacts to (color flood / word / chevrons). */
  children: ReactNode;
  /** When true, fills its parent absolutely (full-bleed under floating chrome). */
  fullBleed?: boolean;
}

/**
 * The main "what to react to" area for Turn & React. It's a thin container that
 * hosts the cue display edge-to-edge so the flood is the dominant surface; the
 * timer, squircle, and controls float over it as separate overlays. Keeping it a
 * named primitive (rather than inline) lets the layout compose the FaceTime
 * arrangement without the cue-rendering details leaking in. Its resting color is
 * the light bloom base so the neutral state is continuous with the glass shell.
 */
export function CueSurface({ children, fullBleed = true }: CueSurfaceProps) {
  return <View style={fullBleed ? styles.fullBleed : styles.inset}>{children}</View>;
}

const styles = StyleSheet.create({
  fullBleed: { ...StyleSheet.absoluteFillObject, backgroundColor: light.base },
  inset: { flex: 1, overflow: 'hidden', backgroundColor: light.mist },
});
