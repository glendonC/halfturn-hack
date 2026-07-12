import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/state/storage';
import { DEFAULT_POSE_MODEL, resolvePoseModel, type PoseModelId, type PoseModelSpec } from './poseModel';

/**
 * Which pose variant the camera runs, persisted so a field A/B block survives a reload
 * mid-session. Selection state only — the registry itself is pure data in `poseModel.ts`,
 * kept separate so `MediaPipeBackend` can depend on the registry without pulling a storage
 * layer into its tests.
 *
 * Writing this is a DEV-ONLY affordance: the picker is `__DEV__`-gated, so a production build
 * has no way to change it and always runs `DEFAULT_POSE_MODEL`.
 */
interface PoseModelStore {
  modelId: PoseModelId;
  setModel: (id: PoseModelId) => void;
  reset: () => void;
}

export const usePoseModelStore = create<PoseModelStore>()(
  persist(
    (set) => ({
      modelId: DEFAULT_POSE_MODEL,
      setModel: (modelId) => set({ modelId }),
      reset: () => set({ modelId: DEFAULT_POSE_MODEL }),
    }),
    {
      name: 'halfturn-pose-model',
      version: 1,
      storage: zustandStorage,
      partialize: (s) => ({ modelId: s.modelId }),
      migrate: (persisted) => {
        const p = persisted as { modelId?: string } | undefined;
        return { modelId: resolvePoseModel(p?.modelId).id };
      },
    },
  ),
);

/**
 * The spec the camera + backend should use right now. A plain getter (not a hook) so the
 * non-React verifier factory reads the same value the camera view renders.
 */
export function getActivePoseModel(): PoseModelSpec {
  return resolvePoseModel(usePoseModelStore.getState().modelId);
}
