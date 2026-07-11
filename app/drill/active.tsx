import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { DrillCountdownView, DrillReadyView, DRILL_LAYOUTS } from '@/components/drill';
import { useDrillBrightness, useTurnReactOrientation } from '@/hooks';
import { MODE_LAYOUT, useDrillEngine } from '@/services/drill';
import { useDrillStore, useSettingsStore } from '@/state';

/**
 * Thin orchestrator for the active drill: wires the engine to the right view
 * for the current status, and — while running — picks the layout for the run's
 * mode. Ready → countdown → layout; lifecycle lives in `useDrillEngine`.
 */
export default function ActiveDrillScreen() {
  const router = useRouter();
  const engine = useDrillEngine();
  const { status } = engine;
  const config = useDrillStore((s) => s.config);
  const mode = useDrillStore((s) => s.config.mode);
  const durationMs = useDrillStore((s) => s.config.durationSec * 1000);
  const cueCount = useDrillStore((s) => s.cuesFired);
  const brightnessBoost = useSettingsStore((s) => s.settings.brightnessBoost);
  const turnReactLandscape = useSettingsStore((s) => s.settings.turnReactLandscape);

  // Opt-in field ergonomics (default off): boost brightness while the drill runs,
  // and rotate Turn & React to landscape for a bigger cue on a mounted phone.
  // Both gate on isRunning so the portrait Ready/Countdown screens are unaffected.
  const isRunning = status === 'running' || status === 'paused';
  useDrillBrightness(brightnessBoost && isRunning);
  useTurnReactOrientation(
    turnReactLandscape && mode === 'turn-react' && isRunning,
  );

  // Start each visit from a clean ready state when arriving idle/finished.
  useEffect(() => {
    const s = useDrillStore.getState().status;
    if (s === 'finished' || s === 'idle') useDrillStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the drill finishes, hand off to the summary screen.
  useEffect(() => {
    if (status === 'finished') router.replace('/drill/summary');
  }, [status, router]);

  if (status === 'idle' || status === 'ready') {
    return (
      <DrillReadyView
        config={config}
        onStart={engine.start}
        onTest={engine.testAudio}
        onBack={() => router.back()}
      />
    );
  }
  if (status === 'countdown') {
    return <DrillCountdownView value={engine.countdownValue} />;
  }
  if (status === 'finished') return null;

  // Pick the layout the run's mode maps to — no branch on the mode itself, so a
  // new mode is additive (a MODE_LAYOUT entry + a DRILL_LAYOUTS entry).
  const Layout = DRILL_LAYOUTS[MODE_LAYOUT[mode]];
  return (
    <Layout engine={engine} durationMs={durationMs} cueCount={cueCount} />
  );
}
