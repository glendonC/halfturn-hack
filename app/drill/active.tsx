import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import {
  CountdownHud,
  DRILL_LAYOUTS,
} from '@/components/drill';
import { useDrillSession } from '@/hooks';
import { MODE_LAYOUT } from '@/services/drill';
import { useDrillStore } from '@/state';

/**
 * Thin active-drill route: ticker + status view. Store remains source of truth.
 * Layout comes from MODE_LAYOUT → DRILL_LAYOUTS (no mode if-else here).
 */
export default function ActiveDrillScreen() {
  useDrillSession();
  const router = useRouter();
  const status = useDrillStore((s) => s.status);
  const mode = useDrillStore((s) => s.config.mode);

  useEffect(() => {
    if (status === 'finished') {
      router.replace('/drill/summary');
    }
  }, [status, router]);

  useEffect(() => {
    const s = useDrillStore.getState().status;
    // Setup owns start; cold entry without an in-flight run goes home.
    if (s === 'idle' || s === 'ready') {
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'finished') return null;
  if (status === 'countdown') return <CountdownHud />;
  if (status === 'running' || status === 'paused') {
    const Layout = DRILL_LAYOUTS[MODE_LAYOUT[mode]];
    return <Layout />;
  }

  return null;
}
