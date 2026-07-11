import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

/**
 * While `active`, lock the screen to landscape so the Turn & React cue is wider
 * and more readable on a mounted phone at 2–4 m; restore portrait (the app's
 * declared orientation) on deactivate/unmount so tab navigation is never left
 * rotated. Opt-in (gated by a setting, default off) and fully isolated — every
 * call is try/caught so an orientation failure never affects the drill.
 */
export function useTurnReactOrientation(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    void (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {
        // Orientation control unavailable — stay in the app's default orientation.
      }
    })();

    return () => {
      void (async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch {
          // Best-effort restore to the app's portrait default.
        }
      })();
    };
  }, [active]);
}
