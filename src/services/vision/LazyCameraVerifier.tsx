import { useEffect, useState, type ComponentType } from 'react';

import { canUseNativeVision } from './runtimeGuard';
import type { CameraVerifierProps } from './CameraVerifierView';

/**
 * Expo-Go-safe wrapper: dynamically loads CameraVerifierView ONLY when
 * canUseNativeVision(). This file imports no native modules (CameraVerifierProps
 * is type-only). Screens may render <LazyCameraVerifier/> unconditionally —
 * it returns null on Expo Go so turn-react stays the beep/preview path.
 */
export function LazyCameraVerifier(props: CameraVerifierProps) {
  const [Comp, setComp] = useState<ComponentType<CameraVerifierProps> | null>(
    null,
  );

  useEffect(() => {
    if (!canUseNativeVision()) return;
    let mounted = true;
    import('./CameraVerifierView')
      .then((m) => {
        if (mounted) setComp(() => m.CameraVerifierView);
      })
      .catch(() => {
        // Native module unavailable — leave unmounted.
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return null;
  return <Comp {...props} />;
}
