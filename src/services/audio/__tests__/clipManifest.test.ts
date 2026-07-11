import { findClip, type ClipManifest } from '../clipManifest';

describe('clipManifest', () => {
  const manifest: ClipManifest = {
    version: 1,
    packId: 'demo',
    clips: [{ cueId: 'scan', assetKey: 'scan_01' }],
  };

  it('finds clips by cue id', () => {
    expect(findClip(manifest, 'scan')?.assetKey).toBe('scan_01');
    expect(findClip(manifest, 'turn')).toBeNull();
    expect(findClip(null, 'scan')).toBeNull();
  });
});
