import type { Landmark, Landmark3D, RawPoseFrame } from '../PerceptionBackend';
import type { CalibrationProfile } from '../types';
import {
  computeHipYawDeg,
  computeNeutralBaselineDeg,
  computeTorsoYawDeg,
  fuse,
  meanFaceVis,
  resolveYawSign,
  shoulderHipSeparationDeg,
} from '../YawFusion';

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const FACE_IDX = [0, 2, 5, 9, 10];

function frame(opts: {
  captureClockMs?: number;
  lShoulder: [number, number, number];
  rShoulder: [number, number, number];
  lHip?: [number, number, number];
  rHip?: [number, number, number];
  lVis?: number;
  rVis?: number;
  faceVis?: number;
}): RawPoseFrame {
  const world: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  world[L_SHOULDER] = {
    x: opts.lShoulder[0],
    y: opts.lShoulder[1],
    z: opts.lShoulder[2],
  };
  world[R_SHOULDER] = {
    x: opts.rShoulder[0],
    y: opts.rShoulder[1],
    z: opts.rShoulder[2],
  };
  if (opts.lHip) {
    world[L_HIP] = { x: opts.lHip[0], y: opts.lHip[1], z: opts.lHip[2] };
  }
  if (opts.rHip) {
    world[R_HIP] = { x: opts.rHip[0], y: opts.rHip[1], z: opts.rHip[2] };
  }
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
  }));
  const visibility = new Array(33).fill(0);
  visibility[L_SHOULDER] = opts.lVis ?? 0.9;
  visibility[R_SHOULDER] = opts.rVis ?? 0.9;
  if (opts.faceVis != null) {
    for (const i of FACE_IDX) visibility[i] = opts.faceVis;
  }
  return {
    captureClockMs: opts.captureClockMs ?? 0,
    landmarks,
    world,
    visibility,
    modelId: 'test',
  };
}

const NEUTRAL: CalibrationProfile = {
  neutralYawBaselineDeg: 0,
  yawSign: 1,
  capturedAtEpochMs: 0,
};

describe('computeTorsoYawDeg', () => {
  it('is ~0 when the chest is square to the camera', () => {
    const yaw = computeTorsoYawDeg(
      frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0] }),
    );
    expect(Math.abs(yaw)).toBeLessThan(1);
  });

  it('grows as a shoulder moves in depth', () => {
    const yaw = computeTorsoYawDeg(
      frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] }),
    );
    expect(yaw).toBeGreaterThan(20);
  });

  it('returns 0 without world landmarks', () => {
    const f: RawPoseFrame = {
      captureClockMs: 0,
      landmarks: [],
      modelId: 'test',
    };
    expect(computeTorsoYawDeg(f)).toBe(0);
  });
});

describe('fuse', () => {
  it('applies yawSign so the player frame can flip', () => {
    const f = frame({
      lShoulder: [-0.2, 0, 0],
      rShoulder: [0.2, 0, 0.2],
    });
    const pos = fuse(f, NEUTRAL);
    const neg = fuse(f, { ...NEUTRAL, yawSign: -1 });
    expect(pos.yawDeg).toBeGreaterThan(0);
    expect(neg.yawDeg).toBeCloseTo(-pos.yawDeg, 5);
  });

  it('subtracts the neutral baseline', () => {
    const f = frame({
      lShoulder: [-0.2, 0, 0],
      rShoulder: [0.2, 0, 0.2],
    });
    const baseline = computeTorsoYawDeg(f);
    const r = fuse(f, { ...NEUTRAL, neutralYawBaselineDeg: baseline });
    expect(Math.abs(r.yawDeg)).toBeLessThan(1e-6);
  });

  it('uses min shoulder visibility as confidence', () => {
    const r = fuse(
      frame({
        lShoulder: [-0.2, 0, 0],
        rShoulder: [0.2, 0, 0],
        lVis: 0.6,
        rVis: 0.95,
      }),
      NEUTRAL,
    );
    expect(r.confidence).toBeCloseTo(0.6, 5);
  });
});

describe('hips + face + calibration helpers', () => {
  it('computes hip yaw and shoulder-hip separation', () => {
    const f = frame({
      lShoulder: [-0.2, 0, 0],
      rShoulder: [0.2, 0, 0.2],
      lHip: [-0.15, 0, 0],
      rHip: [0.15, 0, 0],
    });
    expect(computeHipYawDeg(f)).toBeCloseTo(0, 5);
    expect(shoulderHipSeparationDeg(f)).toBeCloseTo(computeTorsoYawDeg(f), 5);
  });

  it('averages face visibility and neutral baseline', () => {
    expect(
      meanFaceVis(
        frame({
          lShoulder: [-0.2, 0, 0],
          rShoulder: [0.2, 0, 0],
          faceVis: 0.8,
        }),
      ),
    ).toBeCloseTo(0.8, 5);
    const a = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0] });
    const b = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] });
    expect(computeNeutralBaselineDeg([a, b])).toBeCloseTo(
      (computeTorsoYawDeg(a) + computeTorsoYawDeg(b)) / 2,
      5,
    );
  });

  it('resolves yawSign for a left-turn sample', () => {
    expect(resolveYawSign(0, 26.6)).toBe(-1);
    expect(resolveYawSign(0, -26.6)).toBe(1);
  });
});
