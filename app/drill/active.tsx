import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { DrillCountdownView, DrillReadyView, DRILL_LAYOUTS } from '@/components/drill';
import { useDrillBrightness, useTurnReactOrientation } from '@/hooks';
import { MODE_LAYOUT, useDrillEngine } from '@/services/drill';
import { useDrillConfigStore } from '@/state/useDrillConfigStore';
import { useDrillStore } from '@/state/useDrillStore';
import { useSettings } from '@/state/useSettingsStore';

/**
 * Thin orchestrator for the active drill: it wires the engine to the right view
 * for the current status, and — while running — picks the layout for the run's
 * mode (audio HUD vs. Turn & React FaceTime). All view/layout markup + styles
 * live in `src/components/drill`; all lifecycle lives in `useDrillEngine`.
 */
export default function ActiveDrillScreen() {
  const router = useRouter();
  const engine = useDrillEngine();
  const { status } = engine;
  const settings = useSettings();
  const config = useDrillConfigStore((s) => s.config);
  const runDurationSec = useDrillStore((s) => s.runConfig?.durationSec ?? config.durationSec);
  const runMode = useDrillStore((s) => s.runConfig?.mode ?? config.mode);
  const cueCount = useDrillStore((s) => s.events.length);

  // Opt-in field ergonomics (default off): boost brightness while the drill runs,
  // and rotate Turn & React to landscape for a bigger cue on a mounted phone.
  // Both gate on isRunning so the portrait Ready/Countdown screens are unaffected.
  const isRunning = status === 'running' || status === 'paused';
  useDrillBrightness(settings.brightnessBoost && isRunning);
  useTurnReactOrientation(settings.turnReactLandscape && runMode === 'turn-react' && isRunning);

  // Start each visit from a clean "ready" state.
  useEffect(() => {
    const s = useDrillStore.getState().status;
    if (s === 'finished' || s === 'idle') useDrillStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the drill finishes, hand off to the summary screen.
  useEffect(() => {
    if (status === 'finished') router.replace('/drill/summary');
  }, [status, router]);

  if (status === 'idle') {
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

  // Pick the layout the run's mode maps to — no branch on the mode itself, so a
  // new mode is additive (a MODE_LAYOUT entry + a DRILL_LAYOUTS entry).
  const durationMs = runDurationSec * 1000;
  const Layout = DRILL_LAYOUTS[MODE_LAYOUT[runMode]];
  return <Layout engine={engine} durationMs={durationMs} cueCount={cueCount} />;
}
