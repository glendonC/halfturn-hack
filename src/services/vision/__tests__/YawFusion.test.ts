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
  wrapDeg180,
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
  lVis?: number;
  rVis?: number;
  faceVis?: number;
}): RawPoseFrame {
  const world: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  world[L_SHOULDER] = { x: opts.lShoulder[0], y: opts.lShoulder[1], z: opts.lShoulder[2] };
  world[R_SHOULDER] = { x: opts.rShoulder[0], y: opts.rShoulder[1], z: opts.rShoulder[2] };
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  const visibility = new Array(33).fill(0);
  visibility[L_SHOULDER] = opts.lVis ?? 0.9;
  visibility[R_SHOULDER] = opts.rVis ?? 0.9;
  if (opts.faceVis != null) for (const i of FACE_IDX) visibility[i] = opts.faceVis;
  return { captureClockMs: opts.captureClockMs ?? 0, landmarks, world, visibility, modelId: 'test' };
}

const NEUTRAL: CalibrationProfile = { neutralYawBaselineDeg: 0, yawSign: 1, capturedAtEpochMs: 0 };

describe('computeTorsoYawDeg', () => {
  it('is ~0 when the chest is square to the camera (no shoulder depth)', () => {
    const yaw = computeTorsoYawDeg(frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0] }));
    expect(Math.abs(yaw)).toBeLessThan(1);
  });

  it('grows as a shoulder moves in depth (player turns)', () => {
    // right shoulder pushed away in z → positive atan2(sz, sx)
    const yaw = computeTorsoYawDeg(frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] }));
    expect(yaw).toBeGreaterThan(20);
  });

  it('returns neutral (0) when world landmarks are absent', () => {
    const f: RawPoseFrame = { captureClockMs: 0, landmarks: [], modelId: 'test' };
    expect(computeTorsoYawDeg(f)).toBe(0);
  });
});

describe('fuse', () => {
  it('applies the calibrated yawSign so the player frame can be flipped', () => {
    const f = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] }); // torsoYaw ~ +26.6
    const pos = fuse(f, NEUTRAL);
    const neg = fuse(f, { ...NEUTRAL, yawSign: -1 });
    expect(pos.yawDeg).toBeGreaterThan(0);
    expect(neg.yawDeg).toBeCloseTo(-pos.yawDeg, 5);
  });

  it('subtracts the neutral baseline so back-to-camera reads ~0', () => {
    const f = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] });
    const baseline = computeTorsoYawDeg(f);
    const r = fuse(f, { ...NEUTRAL, neutralYawBaselineDeg: baseline });
    expect(Math.abs(r.yawDeg)).toBeLessThan(1e-6);
  });

  it('uses min shoulder visibility as confidence', () => {
    const r = fuse(frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0], lVis: 0.6, rVis: 0.95 }), NEUTRAL);
    expect(r.confidence).toBeCloseTo(0.6, 5);
  });

  it('echoes the capture clock for downstream normalization', () => {
    const r = fuse(frame({ captureClockMs: 1234, lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0] }), NEUTRAL);
    expect(r.captureClockMs).toBe(1234);
  });
});

describe('meanFaceVis + computeNeutralBaselineDeg', () => {
  it('averages anterior face-landmark visibility', () => {
    expect(meanFaceVis(frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0], faceVis: 0.8 }))).toBeCloseTo(0.8, 5);
  });

  it('averages torso yaw across calibration frames', () => {
    const a = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0] }); // ~0
    const b = frame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2] }); // ~+26.6
    const base = computeNeutralBaselineDeg([a, b]);
    expect(base).toBeCloseTo((computeTorsoYawDeg(a) + computeTorsoYawDeg(b)) / 2, 5);
  });
});

describe('resolveYawSign (front-camera mirror resolution)', () => {
  it('flips to -1 when the left turn raised (torso - baseline) above 0', () => {
    // baseline 0, left turn measured +26.6 → must flip so fuse yields yawDeg<0.
    expect(resolveYawSign(0, 26.6)).toBe(-1);
  });

  it('keeps +1 when the left turn drove (torso - baseline) below 0', () => {
    expect(resolveYawSign(0, -26.6)).toBe(1);
  });

  it('accounts for a non-zero neutral baseline (only the delta matters)', () => {
    expect(resolveYawSign(10, 30)).toBe(-1); // delta +20 → flip
    expect(resolveYawSign(10, -5)).toBe(1); // delta -15 → keep
  });

  it('the resolved sign makes a left turn read yawDeg<0 after fuse', () => {
    const baseline = 0;
    const leftTurn = 26.6;
    const sign = resolveYawSign(baseline, leftTurn);
    const yawDeg = (leftTurn - baseline) * sign;
    expect(yawDeg).toBeLessThan(0);
  });
});

/** Frame with independently-posed shoulders AND hips (shoulder/hip decoupling tests). */
function bodyFrame(opts: {
  lShoulder: [number, number, number];
  rShoulder: [number, number, number];
  lHip: [number, number, number];
  rHip: [number, number, number];
  shoulderVis?: number;
  hipVis?: number;
}): RawPoseFrame {
  const world: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  world[L_SHOULDER] = { x: opts.lShoulder[0], y: opts.lShoulder[1], z: opts.lShoulder[2] };
  world[R_SHOULDER] = { x: opts.rShoulder[0], y: opts.rShoulder[1], z: opts.rShoulder[2] };
  world[L_HIP] = { x: opts.lHip[0], y: opts.lHip[1], z: opts.lHip[2] };
  world[R_HIP] = { x: opts.rHip[0], y: opts.rHip[1], z: opts.rHip[2] };
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  const visibility = new Array(33).fill(0);
  visibility[L_SHOULDER] = opts.shoulderVis ?? 0.9;
  visibility[R_SHOULDER] = opts.shoulderVis ?? 0.9;
  visibility[L_HIP] = opts.hipVis ?? 0.8;
  visibility[R_HIP] = opts.hipVis ?? 0.8;
  return { captureClockMs: 0, landmarks, world, visibility, modelId: 'test' };
}

const SQUARE_SHOULDERS: [[number, number, number], [number, number, number]] = [
  [-0.2, 0, 0],
  [0.2, 0, 0],
];
const SQUARE_HIPS: [[number, number, number], [number, number, number]] = [
  [-0.15, 0, 0],
  [0.15, 0, 0],
];

describe('computeHipYawDeg', () => {
  it('is ~0 when the pelvis is square to the camera', () => {
    const yaw = computeHipYawDeg(
      bodyFrame({ lShoulder: SQUARE_SHOULDERS[0], rShoulder: SQUARE_SHOULDERS[1], lHip: SQUARE_HIPS[0], rHip: SQUARE_HIPS[1] }),
    );
    expect(Math.abs(yaw)).toBeLessThan(1);
  });

  it('grows as a hip moves in depth (whole-body pivot)', () => {
    const yaw = computeHipYawDeg(
      bodyFrame({ lShoulder: SQUARE_SHOULDERS[0], rShoulder: SQUARE_SHOULDERS[1], lHip: [-0.15, 0, 0], rHip: [0.15, 0, 0.15] }),
    );
    expect(yaw).toBeGreaterThan(20);
  });

  it('returns neutral (0) when world landmarks are absent', () => {
    expect(computeHipYawDeg({ captureClockMs: 0, landmarks: [], modelId: 'test' })).toBe(0);
  });
});

describe('shoulderHipSeparationDeg (upper-body-leads-hips discriminator)', () => {
  it('≈ torso yaw when the shoulders rotate but the hips stay square (a trunk check)', () => {
    const f = bodyFrame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2], lHip: SQUARE_HIPS[0], rHip: SQUARE_HIPS[1] });
    expect(shoulderHipSeparationDeg(f)).toBeCloseTo(computeTorsoYawDeg(f), 5); // hips ~0 → sep ~ torso
    expect(shoulderHipSeparationDeg(f)).toBeGreaterThan(20);
  });

  it('≈ 0 when shoulders and hips rotate together (a whole-body pivot)', () => {
    const f = bodyFrame({ lShoulder: [-0.2, 0, 0], rShoulder: [0.2, 0, 0.2], lHip: [-0.15, 0, 0], rHip: [0.15, 0, 0.15] });
    expect(Math.abs(shoulderHipSeparationDeg(f))).toBeLessThan(8); // both rotate → little separation
  });
});

describe('fuse — additive hip/separation fields', () => {
  it('populates hipYawDeg, shoulderHipSepDeg, and hipConfidence without affecting yawDeg', () => {
    const f = bodyFrame({
      lShoulder: [-0.2, 0, 0],
      rShoulder: [0.2, 0, 0.2],
      lHip: SQUARE_HIPS[0],
      rHip: SQUARE_HIPS[1],
      hipVis: 0.7,
    });
    const r = fuse(f, NEUTRAL);
    expect(r.hipYawDeg).toBeCloseTo(computeHipYawDeg(f), 5);
    expect(r.shoulderHipSepDeg).toBeCloseTo(r.torsoYawDeg - r.hipYawDeg, 5);
    expect(r.hipConfidence).toBeCloseTo(0.7, 5);
    // yawDeg is still the shoulder-derived, baseline-subtracted, signed value — unchanged.
    expect(r.yawDeg).toBeCloseTo(r.torsoYawDeg, 5);
  });
});

describe('wrapDeg180 (the ±180° seam)', () => {
  it('wraps angle differences into (−180, 180]', () => {
    expect(wrapDeg180(0)).toBe(0);
    expect(wrapDeg180(316)).toBe(-44);
    expect(wrapDeg180(-190)).toBe(170);
    expect(wrapDeg180(180)).toBe(180);
    expect(wrapDeg180(-180)).toBe(180);
    expect(wrapDeg180(540)).toBe(180);
    expect(wrapDeg180(-44)).toBe(-44);
  });

  it('resolveYawSign wraps the calibration delta across the seam', () => {
    // Back-turned baseline −156°, left capture reads +150°: linear delta is
    // +306 (would resolve −1); the true circular delta is −54 → sign +1.
    expect(resolveYawSign(-156, 150)).toBe(1);
    // And the plain no-seam case is unchanged.
    expect(resolveYawSign(0, 40)).toBe(-1);
    expect(resolveYawSign(0, -40)).toBe(1);
  });
});
