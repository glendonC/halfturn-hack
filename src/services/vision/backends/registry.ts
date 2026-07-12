import type { PerceptionBackend } from '../PerceptionBackend';
import { DEFAULT_POSE_MODEL_SPEC, type PoseModelSpec } from '../poseModel';
import { NullBackend } from './NullBackend';

/**
 * Backend priority order. `pickBackend()` tries each factory and returns the
 * first that reports `available()`. The native MediaPipe backend (primary) and
 * the MoveNet/tflite fallback are registered here in a DEV BUILD via dynamic
 * import — kept commented out so the Expo Go bundle never references
 * vision-camera (the CI guard enforces this). Adding ExecuTorch / a custom net
 * later is one more line here; nothing above this boundary changes.
 *
 * `model` selects which pose variant the MediaPipe backend stamps and reports. It is passed
 * IN (from the persisted selection, read in `getPoseVerifierAsync`) rather than read here, so
 * the registry stays free of store/storage imports.
 */
type BackendFactory = (model: PoseModelSpec) => Promise<PerceptionBackend>;

const REGISTRY: BackendFactory[] = [
  // Dev build only: the dynamic import keeps react-native-vision-camera /
  // MediaPipe out of the Expo Go bundle (it's reached only when VISION_ENABLED
  // gates getPoseVerifierAsync into pickBackend). MediaPipeBackend itself imports
  // only a TYPE from the pose package, so this load is native-runtime-free.
  (model) => import('../backends/MediaPipeBackend').then((m) => new m.MediaPipeBackend(model)),
  // MoveNet/tflite fallback — still deferred (see perception-architecture §6):
  // () => import('../backends/MoveNetTfliteBackend').then((m) => new m.MoveNetTfliteBackend()),
  async () => new NullBackend(),
];

export async function pickBackend(
  model: PoseModelSpec = DEFAULT_POSE_MODEL_SPEC,
): Promise<PerceptionBackend> {
  for (const make of REGISTRY) {
    try {
      const backend = await make(model);
      if (await backend.available()) return backend;
    } catch {
      // Backend not loadable in this build (e.g. Expo Go) — skip it.
    }
  }
  return new NullBackend();
}
