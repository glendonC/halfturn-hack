import type { ComponentType } from 'react';

import type { DrillLayout } from '@/services/drill';
import { AudioDrillLayout } from './AudioDrillLayout';
import type { DrillLayoutProps } from './layoutProps';
import { TurnReactLayout } from './TurnReactLayout';

/**
 * Layout id → running-drill component. The active screen resolves the run's mode
 * to a `DrillLayout` (via `MODE_LAYOUT`) and renders the matching component here,
 * so it never branches on the mode. Adding a mode = a new `MODE_LAYOUT` entry +
 * (if it needs a new look) a new entry here — the active screen is untouched.
 */
export const DRILL_LAYOUTS: Record<DrillLayout, ComponentType<DrillLayoutProps>> = {
  'audio-hud': AudioDrillLayout,
  'turn-react-facetime': TurnReactLayout,
};
