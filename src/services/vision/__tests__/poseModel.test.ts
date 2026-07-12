import {
  DEFAULT_POSE_MODEL,
  DEFAULT_POSE_MODEL_SPEC,
  POSE_MODELS,
  POSE_MODEL_IDS,
  resolvePoseModel,
} from '../poseModel';

describe('pose model registry', () => {
  it('keeps lite as the default until the benchmark says otherwise', () => {
    expect(DEFAULT_POSE_MODEL).toBe('lite');
    expect(DEFAULT_POSE_MODEL_SPEC).toBe(POSE_MODELS.lite);
  });

  it('names a .task file the config plugin can bundle, for every variant', () => {
    for (const id of POSE_MODEL_IDS) {
      const spec = POSE_MODELS[id];
      // A bare filename, not a path or a require() handle: the native side resolves it from
      // the app bundle (iOS Bundle.main / Android assets).
      expect(spec.file).toMatch(/^pose_landmarker_\w+\.task$/);
      expect(spec.file).not.toContain('/');
    }
  });

  it('gives each variant a DISTINCT provenance stamp', () => {
    // Two arms that stamp the same modelId/version are indistinguishable in a capture, which
    // silently destroys the A/B comparison — so this is the load-bearing property.
    const modelIds = POSE_MODEL_IDS.map((id) => POSE_MODELS[id].modelId);
    const versions = POSE_MODEL_IDS.map((id) => POSE_MODELS[id].version);
    expect(new Set(modelIds).size).toBe(POSE_MODEL_IDS.length);
    expect(new Set(versions).size).toBe(POSE_MODEL_IDS.length);
  });

  it('falls back to the default for an unknown or missing persisted id', () => {
    // A persisted store from a build that knew other variants must not brick the camera.
    expect(resolvePoseModel('thunder')).toBe(DEFAULT_POSE_MODEL_SPEC);
    expect(resolvePoseModel(undefined)).toBe(DEFAULT_POSE_MODEL_SPEC);
    expect(resolvePoseModel(null)).toBe(DEFAULT_POSE_MODEL_SPEC);
  });

  it('round-trips a known id', () => {
    expect(resolvePoseModel('full')).toBe(POSE_MODELS.full);
    expect(resolvePoseModel('lite')).toBe(POSE_MODELS.lite);
  });
});
