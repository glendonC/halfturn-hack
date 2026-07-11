import { create } from 'zustand';

import { DEFAULT_CALIBRATION, type CalibrationProfile } from './types';

/**
 * Per-player camera calibration. In-memory for now (Expo-Go-safe).
 * Framing persists "use last setup" within the app session.
 */
interface CalibrationStore {
  profile: CalibrationProfile;
  setProfile: (profile: CalibrationProfile) => void;
  reset: () => void;
}

export const useCalibrationStore = create<CalibrationStore>((set) => ({
  profile: DEFAULT_CALIBRATION,
  setProfile: (profile) => set({ profile }),
  reset: () => set({ profile: DEFAULT_CALIBRATION }),
}));
