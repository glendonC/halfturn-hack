import type { DrillMode } from '@/types';

import { AudioDrillBehavior } from './AudioDrillBehavior';
import { TurnReactDrillBehavior } from './TurnReactDrillBehavior';
import type { DrillLayout, DrillModeBehavior } from './types';

/**
 * Mode-strategy registry. Engine / store ask for a behavior instead of
 * branching on mode; a new mode is one case here.
 */
export function getDrillModeBehavior(mode: DrillMode): DrillModeBehavior {
  switch (mode) {
    case 'turn_react':
      return new TurnReactDrillBehavior();
    case 'audio':
    default:
      return new AudioDrillBehavior();
  }
}

/** Single source of truth for which layout each mode renders while running. */
export const MODE_LAYOUT: Record<DrillMode, DrillLayout> = {
  audio: 'audio-hud',
  turn_react: 'turn-react-surface',
};

export { AudioDrillBehavior } from './AudioDrillBehavior';
export { TurnReactDrillBehavior } from './TurnReactDrillBehavior';
export type {
  DrillLayout,
  DrillModeBehavior,
  PickedCue,
  ResolvedCue,
} from './types';
