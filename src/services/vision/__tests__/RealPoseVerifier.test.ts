import { getCueDefinition } from '@/constants';
import type { YawSample } from '@/types';

import { NullBackend } from '../backends/NullBackend';
import { MediaPipeBackend, feedRawFrame } from '../backends/MediaPipeBackend';
import { RealPoseVerifier } from '../RealPoseVerifier';
import type { Landmark3D, RawPoseFrame } from '../PerceptionBackend';

const L_SHOULDER = 11;
const R_SHOULDER = 12;

function frameAt(captureClockMs: number, yawDeg: number): RawPoseFrame {
  const rad = (yawDeg * Math.PI) / 180;
  const world: Landmark3D[] = Array.from({ length: 25 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0.9,
  }));
  world[R_SHOULDER] = {
    x: 0.2 * Math.cos(rad),
    y: 0,
    z: 0.2 * Math.sin(rad),
    visibility: 0.9,
  };
  world[L_SHOULDER] = {
    x: -0.2 * Math.cos(rad),
    y: 0,
    z: -0.2 * Math.sin(rad),
    visibility: 0.9,
  };
  return {
    captureClockMs,
    landmarks: world.map((w) => ({ x: w.x, y: w.y, z: w.z, visibility: 0.9 })),
    world,
    visibility: world.map(() => 0.9),
    modelId: 'test',
  };
}

function yawTrace(yaws: number[], periodMs = 33): YawSample[] {
  return yaws.map((yawDeg, i) => ({
    drillMs: i * periodMs,
    wallMs: i * periodMs,
    yaw: (yawDeg * Math.PI) / 180,
    confidence: 0.9,
  }));
}

describe('RealPoseVerifier', () => {
  it('reports unavailable for NullBackend', () => {
    const v = new RealPoseVerifier(new NullBackend());
    expect(v.available).toBe(false);
  });

  it('returns unknown with no samples', () => {
    const v = new RealPoseVerifier(new NullBackend());
    const result = v.verifyCue({
      cue: getCueDefinition('scan'),
      cueOnsetDrillMs: 100,
      samples: [],
      windowMs: { early: 250, late: 1200 },
    });
    expect(result.outcome).toBe('unknown');
  });

  it('verifies a post-cue left turn from synthetic yaw samples', () => {
    const v = new RealPoseVerifier(new NullBackend());
    // Cue at 100ms; turn peaks around 200ms.
    const samples = yawTrace([0, 0, -30, -40, -45, -40, -30, -10, 0], 33);
    const result = v.verifyCue({
      cue: getCueDefinition('check_left'),
      cueOnsetDrillMs: 50,
      samples,
      windowMs: { early: 250, late: 1200 },
    });
    expect(result.outcome).toBe('verified');
    expect(result.backendId).toContain('null');
    expect(result.reactionMs).toBeGreaterThanOrEqual(0);
  });

  it('marks anticipation when the turn peaks before the cue', () => {
    const v = new RealPoseVerifier(new NullBackend());
    const samples = yawTrace([0, 0, -30, -40, -45, -40, -30, -10, 0], 33);
    const result = v.verifyCue({
      cue: getCueDefinition('turn'),
      cueOnsetDrillMs: 400,
      samples,
      windowMs: { early: 800, late: 1200 },
    });
    expect(result.outcome).toBe('anticipated');
  });

  it('buffers frames from MediaPipeBackend via feedRawFrame', () => {
    const backend = new MediaPipeBackend();
    const v = new RealPoseVerifier(backend);
    v.start(0);
    // Script a short left turn on the capture clock.
    const yaws = [0, 0, -30, -40, -45, -40, -30, -10, 0];
    yaws.forEach((yaw, i) => {
      feedRawFrame(frameAt(i * 33, yaw));
    });
    expect(v.getYawSamples().length).toBe(yaws.length);
    v.stop();
  });
});
