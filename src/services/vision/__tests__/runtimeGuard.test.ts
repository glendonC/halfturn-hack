import {
  canUseNativeVision,
  isExpoGo,
  isVisionEnvEnabled,
} from '../runtimeGuard';

describe('vision runtime guard', () => {
  const prev = process.env.EXPO_PUBLIC_VISION;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_VISION;
    else process.env.EXPO_PUBLIC_VISION = prev;
  });

  it('treats missing EXPO_PUBLIC_VISION as disabled', () => {
    delete process.env.EXPO_PUBLIC_VISION;
    expect(isVisionEnvEnabled()).toBe(false);
  });

  it('reads EXPO_PUBLIC_VISION=1 as enabled', () => {
    process.env.EXPO_PUBLIC_VISION = '1';
    expect(isVisionEnvEnabled()).toBe(true);
  });

  it('canUseNativeVision requires the env flag (Expo Go still blocks via isExpoGo)', () => {
    delete process.env.EXPO_PUBLIC_VISION;
    expect(canUseNativeVision()).toBe(false);
    process.env.EXPO_PUBLIC_VISION = '1';
    // In Jest we are not StoreClient; flag alone is not enough to claim camera —
    // canUseNativeVision is flag && !isExpoGo(). Jest typically is not Expo Go.
    expect(typeof isExpoGo()).toBe('boolean');
    expect(canUseNativeVision()).toBe(!isExpoGo());
  });
});
