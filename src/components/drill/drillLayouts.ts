import type { ComponentType } from 'react';

import type { DrillLayout } from '@/services/drill';

import { AudioDrillLayout } from './AudioDrillLayout';
import { TurnReactLayout } from './TurnReactLayout';
import type { DrillLayoutProps } from './layoutProps';

/**
 * UI registry keyed by DrillLayout. Active screen resolves MODE_LAYOUT[mode]
 * then renders from here — no mode string branches in the route.
 */
export const DRILL_LAYOUTS: Record<
  DrillLayout,
  ComponentType<DrillLayoutProps>
> = {
  'audio-hud': AudioDrillLayout,
  'turn-react-facetime': TurnReactLayout,
};
