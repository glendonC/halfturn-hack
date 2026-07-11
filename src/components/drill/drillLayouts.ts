import type { ComponentType } from 'react';

import type { DrillLayout } from '@/services/drill';

import { ActiveHud } from './ActiveHud';
import { ActiveTurnReactHud } from './ActiveTurnReactHud';
import type { DrillLayoutProps } from './layoutProps';

/**
 * UI registry keyed by DrillLayout. Active screen resolves MODE_LAYOUT[mode]
 * then renders from here — no mode string branches in the route.
 */
export const DRILL_LAYOUTS: Record<
  DrillLayout,
  ComponentType<DrillLayoutProps>
> = {
  'audio-hud': ActiveHud,
  'turn-react-surface': ActiveTurnReactHud,
};
