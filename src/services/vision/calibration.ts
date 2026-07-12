import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/state/storage';
import { DEFAULT_CALIBRATION, type CalibrationProfile } from './types';

/**
 * Per-player camera calibration, persisted (kv-store) so "use last setup" can
 * skip the framing step. Captured during framing: the neutral (back-to-camera)
 * yaw baseline and the yaw sign. Pure key-value persistence — Expo-Go-safe; no
 * camera imports.
 */
interface CalibrationStore {
  profile: CalibrationProfile;
  setProfile: (profile: CalibrationProfile) => void;
  reset: () => void;
}

export const useCalibrationStore = create<CalibrationStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_CALIBRATION,
      setProfile: (profile) => set({ profile }),
      reset: () => set({ profile: DEFAULT_CALIBRATION }),
    }),
    {
      name: 'halfturn-calibration',
      version: 1,
      storage: zustandStorage,
      partialize: (s) => ({ profile: s.profile }),
      migrate: (persisted) => {
        const p = persisted as { profile?: Partial<CalibrationProfile> } | undefined;
        return { profile: { ...DEFAULT_CALIBRATION, ...(p?.profile ?? {}) } };
      },
    },
  ),
);
