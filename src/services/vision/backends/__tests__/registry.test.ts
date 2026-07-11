import { NullBackend } from '../NullBackend';
import { pickBackend } from '../registry';

describe('perception backend registry', () => {
  it('resolves the null backend when no native slot is available', async () => {
    const backend = await pickBackend();
    expect(backend.id).toBe('null');
    expect(backend.version).toBe('0');
    expect(await backend.available()).toBe(false);
  });

  it('NullBackend never emits frames', () => {
    const backend = new NullBackend();
    let called = false;
    backend.start();
    backend.onRawPose(() => {
      called = true;
    });
    backend.stop();
    expect(called).toBe(false);
  });
});
