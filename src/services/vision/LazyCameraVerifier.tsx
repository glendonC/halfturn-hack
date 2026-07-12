import { useEffect, useState, type ComponentType } from 'react';

import type { CameraVerifierProps } from './CameraVerifierView';

// Same definition as VISION_ENABLED in ./index, inlined to avoid an index↔this
// import cycle (index re-exports this component).
const VISION_ENABLED = process.env.EXPO_PUBLIC_VISION === '1';

/**
 * Expo-Go-safe wrapper that lazily loads CameraVerifierView ONLY in a dev build
 * (VISION_ENABLED). The dynamic import keeps react-native-vision-camera and the
 * MediaPipe pose module out of the Expo Go bundle's EVALUATED graph; this file
 * itself imports no native code (the CameraVerifierProps import is type-only and
 * is erased). Screens render <LazyCameraVerifier/> unconditionally — it returns
 * null in Expo Go (so turn-react there is the beep-only preview).
 */
export function LazyCameraVerifier(props: CameraVerifierProps) {
  const [Comp, setComp] = useState<ComponentType<CameraVerifierProps> | null>(null);

  useEffect(() => {
    if (!VISION_ENABLED) return;
    let mounted = true;
    import('./CameraVerifierView')
      .then((m) => {
        if (mounted) setComp(() => m.CameraVerifierView);
      })
      .catch(() => {
        // Native module unavailable — leave unmounted; the drill still runs (the
        // verifier simply receives no frames and yields 0 scans).
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return null;
  return <Comp {...props} />;
}
