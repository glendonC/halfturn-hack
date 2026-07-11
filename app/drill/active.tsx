import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { CountdownHud, DRILL_LAYOUTS } from '@/components/drill';
import { useDrillBrightness, useTurnReactOrientation } from '@/hooks';
import { MODE_LAYOUT, useDrillEngine } from '@/services/drill';
import { useDrillStore, useSettingsStore } from '@/state';

/**
 * Thin active-drill route: engine owns lifecycle; layout from MODE_LAYOUT.
 * Opt-in field ergonomics (brightness / landscape) apply while running/paused.
 */
export default function ActiveDrillScreen() {
  const router = useRouter();
  const engine = useDrillEngine();
  const mode = useDrillStore((s) => s.config.mode);
  const durationMs = useDrillStore((s) => s.config.durationMs);
  const brightnessBoost = useSettingsStore((s) => s.settings.brightnessBoost);
  const turnReactLandscape = useSettingsStore((s) => s.settings.turnReactLandscape);
  const started = useRef(false);

  const isRunning = engine.status === 'running' || engine.status === 'paused';
  useDrillBrightness(brightnessBoost && isRunning);
  useTurnReactOrientation(
    turnReactLandscape && mode === 'turn_react' && isRunning,
  );

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
