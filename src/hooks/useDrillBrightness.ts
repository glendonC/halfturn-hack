import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';

/**
 * While `active`, max out the app's screen brightness for outdoor visibility,
 * restoring the previous brightness on deactivate/unmount. Opt-in (gated by a
 * setting, default off). Defensive: every call is try/caught so a brightness
 * failure never affects the drill. Not camera-gated — works in Expo Go too.
 */
export function useDrillBrightness(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let previous: number | null = null;

    void (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!cancelled) await Brightness.setBrightnessAsync(1);
      } catch {
        // Brightness control unavailable — leave the screen as-is.
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          if (previous != null) await Brightness.setBrightnessAsync(previous);
          else await Brightness.restoreSystemBrightnessAsync();
        } catch {
          // Best-effort restore.
        }
      })();
    };
  }, [active]);
}
