import type { PerceptionBackend } from '../PerceptionBackend';
import { NullBackend } from './NullBackend';

/**
 * Backend priority order. pickBackend() tries each factory and returns the
 * first that reports available(). Native MediaPipe is a STUB SLOT for a later
 * unlock — never statically imported here so Expo Go stays clean.
 */
type BackendFactory = () => Promise<PerceptionBackend>;

const REGISTRY: BackendFactory[] = [
  // Dev-client unlock later (issue #25+):
  // () =>
  //   import('../backends/MediaPipeBackend').then((m) => new m.MediaPipeBackend()),
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
