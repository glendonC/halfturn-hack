import { MediaPipeBackend, toRawPoseFrame } from '../backends/MediaPipeBackend';
import { POSE_MODELS } from '../poseModel';

// The bundle type comes from the (type-only) pose package import; derive it from
// the function signature so this test needs no package/runtime dependency.
type Bundle = Parameters<typeof toRawPoseFrame>[0];

const lm = (visibility?: number) => ({ x: 0, y: 0, z: 0, visibility });

function bundle(opts: { worldHasVisibility: boolean }): Bundle {
  const image = Array.from({ length: 33 }, (_, i) => lm(i === 11 || i === 12 ? 0.9 : 0.1));
  const world = Array.from({ length: 33 }, (_, i) =>
    lm(opts.worldHasVisibility ? (i === 11 || i === 12 ? 0.8 : 0.05) : undefined),
  );
  return {
    inferenceTime: 12,
    inputImageWidth: 1,
    inputImageHeight: 1,
    results: [{ landmarks: [image], worldLandmarks: [world], segmentationMasks: [] }],
  } as Bundle;
}

const LITE = POSE_MODELS.lite.modelId;

describe('toRawPoseFrame', () => {
  it('sources shoulder visibility from IMAGE landmarks even when world omits it', () => {
    // MediaPipe Pose carries visibility on the normalized/image list, not world.
    const raw = toRawPoseFrame(bundle({ worldHasVisibility: false }), LITE);
    expect(raw).not.toBeNull();
    expect(raw!.visibility?.[11]).toBeCloseTo(0.9, 5);
    expect(raw!.visibility?.[12]).toBeCloseTo(0.9, 5);
  });

  it('returns null when there is no pose', () => {
    const empty = { inferenceTime: 0, inputImageWidth: 1, inputImageHeight: 1, results: [] } as Bundle;
    expect(toRawPoseFrame(empty, LITE)).toBeNull();
  });

  it('emits 33 world landmarks, a numeric capture clock, and the model id', () => {
    const raw = toRawPoseFrame(bundle({ worldHasVisibility: true }), LITE);
    expect(raw!.world).toHaveLength(33);
    expect(typeof raw!.captureClockMs).toBe('number');
    expect(raw!.modelId).toBe('pose_landmarker_lite');
  });

  // Provenance is what makes an A/B benchmark scoreable: two arms whose frames claim the same
  // model are indistinguishable in the capture, and the comparison is lost.
  it('stamps whichever variant the caller names', () => {
    const raw = toRawPoseFrame(bundle({ worldHasVisibility: true }), POSE_MODELS.full.modelId);
    expect(raw!.modelId).toBe('pose_landmarker_full');
  });
});

describe('MediaPipeBackend provenance', () => {
  it('reports the injected variant version (which becomes ScanVerification.engine)', () => {
    expect(new MediaPipeBackend(POSE_MODELS.full).version).toBe('pose-full-0.4.0');
    expect(new MediaPipeBackend(POSE_MODELS.lite).version).toBe('pose-lite-0.4.0');
  });

  it('defaults to the lite spec so an un-injected backend is never mislabeled', () => {
    expect(new MediaPipeBackend().version).toBe(POSE_MODELS.lite.version);
  });
});
