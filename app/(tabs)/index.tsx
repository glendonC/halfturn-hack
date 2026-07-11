import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';

import { ActiveHud } from '@/components/drill/ActiveHud';
import { ActiveTurnReactHud } from '@/components/drill/ActiveTurnReactHud';
import { CountdownHud } from '@/components/drill/CountdownHud';
import { DrillSetup } from '@/components/drill/DrillSetup';
import { FinishedSummary } from '@/components/drill/FinishedSummary';
import { useDrillSession } from '@/hooks';
import { useDrillStore } from '@/state';
import { colors } from '@/theme';

/**
 * Train tab orchestrator — store is source of truth; screens stay thin.
 * setup → countdown → active HUD → summary
 */
export default function TrainScreen() {
  useDrillSession();
  const navigation = useNavigation();
  const status = useDrillStore((s) => s.status);
  const mode = useDrillStore((s) => s.config.mode);
  const immersive =
    status === 'countdown' || status === 'running' || status === 'paused';

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: immersive
        ? { display: 'none' }
        : {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
          },
    });
  }, [immersive, navigation]);

  if (status === 'countdown') return <CountdownHud />;
  if (status === 'running' || status === 'paused') {
    return mode === 'turn_react' ? <ActiveTurnReactHud /> : <ActiveHud />;
  }
  if (status === 'finished') return <FinishedSummary />;
  return <DrillSetup />;
}
