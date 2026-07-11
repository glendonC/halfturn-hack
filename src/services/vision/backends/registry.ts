import type { PerceptionBackend } from '../PerceptionBackend';
import { NullBackend } from './NullBackend';

/**
 * Backend priority order. pickBackend() tries each factory and returns the
 * first that reports available(). MediaPipe is dynamically imported so Expo Go
 * never evaluates native camera code through this module.
 */
type BackendFactory = () => Promise<PerceptionBackend>;

const REGISTRY: BackendFactory[] = [
  () => import('./MediaPipeBackend').then((m) => new m.MediaPipeBackend()),
  async () => new NullBackend(),
];

export async function pickBackend(): Promise<PerceptionBackend> {
  for (const make of REGISTRY) {
    try {
      const backend = await make();
      if (await backend.available()) return backend;
    } catch {
      // Backend not loadable in this build — skip.
    }
  }
  return new NullBackend();
}
