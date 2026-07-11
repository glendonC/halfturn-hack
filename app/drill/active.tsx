import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { CountdownHud, DRILL_LAYOUTS } from '@/components/drill';
import { MODE_LAYOUT, useDrillEngine } from '@/services/drill';
import { useDrillStore } from '@/state';

/**
 * Thin active-drill route: engine owns lifecycle; layout from MODE_LAYOUT.
 */
export default function ActiveDrillScreen() {
  const router = useRouter();
  const engine = useDrillEngine();
  const mode = useDrillStore((s) => s.config.mode);
  const durationMs = useDrillStore((s) => s.config.durationMs);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const s = useDrillStore.getState().status;
    if (s === 'ready') {
      started.current = true;
      engine.start();
      return;
    }
    if (s === 'idle' || s === 'finished') {
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engine.status === 'finished') {
      router.replace('/drill/summary');
    }
  }, [engine.status, router]);

  if (engine.status === 'finished') return null;
  if (engine.status === 'countdown') {
    return <CountdownHud engine={engine} />;
  }
  if (engine.status === 'running' || engine.status === 'paused') {
    const Layout = DRILL_LAYOUTS[MODE_LAYOUT[mode]];
    return (
      <Layout
        engine={engine}
        durationMs={durationMs}
        cueCount={engine.cueCount}
      />
    );
  }

  return null;
}
