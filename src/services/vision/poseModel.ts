/**
 * The pose-model registry — the ONE place that knows which MediaPipe Pose Landmarker
 * variants exist, what file each one loads, and the provenance strings each stamps onto a
 * session.
 *
 * Why this file exists: the model used to be hardcoded in three places that had no way to
 * stay in sync — the filename in `CameraVerifierView`, the `modelId`/`version` in
 * `MediaPipeBackend`, and the download URL in `scripts/fetch-pose-model.sh`. A benchmark that
 * swaps the model but not the provenance stamp produces captures you cannot tell apart, so the
 * comparison is unscoreable. Now the filename and the stamp come from one spec.
 *
 * How the swap works at runtime: the pose library takes the model as a BARE FILENAME
 * (`usePoseDetection(cb, mode, model, opts)`), resolved from the app bundle natively, and
 * re-creates its detector whenever that string changes. The pose config plugin bundles EVERY
 * `.task` under `assets/models/` (app.json `assetsPaths`). So once both files are fetched and
 * the app is built once, switching variants is a live JS-side change — no rebuild, no Metro
 * restart. That is what makes an A/B field session practical.
 *
 * PURE data + a resolver: no zustand, no storage, no native types (the Expo Go guard does not
 * exempt `import type`). The persisted *selection* lives in `poseModelStore.ts` so that the
 * backend can depend on the registry without dragging a storage layer into its tests.
 */

export type PoseModelId = 'lite' | 'full';

export interface PoseModelSpec {
  id: PoseModelId;
  /** Bare filename the native plugin resolves from the app bundle. */
  file: string;
  /** Provenance stamp carried on every RawPoseFrame. */
  modelId: string;
  /** Backend version; lands in `ScanVerification.engine` (e.g. "mediapipe@pose-full-0.4.0"). */
  version: string;
  /** Approximate download size, MB — shown in the dev picker so the cost is visible. */
  approxSizeMb: number;
}

/**
 * Keep in sync with `scripts/fetch-pose-model.sh` (which downloads these files). Bash cannot
 * import TypeScript, so the filename list is deliberately duplicated there and nowhere else.
 */
export const POSE_MODELS: Record<PoseModelId, PoseModelSpec> = {
  lite: {
    id: 'lite',
    file: 'pose_landmarker_lite.task',
    modelId: 'pose_landmarker_lite',
    version: 'pose-lite-0.4.0',
    approxSizeMb: 5.5,
  },
  full: {
    id: 'full',
    file: 'pose_landmarker_full.task',
    modelId: 'pose_landmarker_full',
    version: 'pose-full-0.4.0',
    approxSizeMb: 9.0,
  },
};

export const POSE_MODEL_IDS = Object.keys(POSE_MODELS) as PoseModelId[];

/**
 * `lite` stays the default until the on-device benchmark says otherwise. `full` is a heavier
 * net and the ~15fps native cap leaves little headroom, so it must EARN the default by beating
 * lite on cued direction accuracy and turn recall while holding the fps floor — see
 * docs/perception-architecture.md.
 */
export const DEFAULT_POSE_MODEL: PoseModelId = 'lite';

export const DEFAULT_POSE_MODEL_SPEC: PoseModelSpec = POSE_MODELS[DEFAULT_POSE_MODEL];

/** Resolve a (possibly stale or unknown) persisted id to a spec; unknown falls back to the default. */
export function resolvePoseModel(id: string | undefined | null): PoseModelSpec {
  return POSE_MODELS[id as PoseModelId] ?? DEFAULT_POSE_MODEL_SPEC;
}
