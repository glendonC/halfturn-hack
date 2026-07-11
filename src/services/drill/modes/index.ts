import type { DrillMode } from '@/types';
import { AudioDrillBehavior } from './AudioDrillBehavior';
import { TurnReactDrillBehavior } from './TurnReactDrillBehavior';
import type { DrillLayout, DrillModeBehavior } from './types';

/**
 * The mode-strategy registry. `getDrillModeBehavior(mode)` is the single place
 * that knows which behavior a mode uses; the engine and the active screen ask
 * for a behavior instead of branching on the mode. A new mode is one case here.
 */
export function getDrillModeBehavior(mode: DrillMode): DrillModeBehavior {
  switch (mode) {
    case 'turn-react':
      return new TurnReactDrillBehavior();
    case 'audio':
    default:
      return new AudioDrillBehavior();
  }
}

/**
 * The single source of truth for which layout each mode renders while running.
 * The active screen resolves `MODE_LAYOUT[mode]` and renders the matching
 * component from the UI-layer `DRILL_LAYOUTS` registry — so it never branches on
 * the mode, and a new mode's layout is one entry here (+ one in that registry).
 */
export const MODE_LAYOUT: Record<DrillMode, DrillLayout> = {
  audio: 'audio-hud',
  'turn-react': 'turn-react-facetime',
};

export { AudioDrillBehavior } from './AudioDrillBehavior';
export { TurnReactDrillBehavior } from './TurnReactDrillBehavior';
export type { DrillLayout, DrillModeBehavior, PickedCue, ResolvedCue } from './types';
