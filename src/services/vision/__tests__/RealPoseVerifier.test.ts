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

describe('RealPoseVerifier', () => {
  it('reports unavailable for NullBackend', () => {
    const v = new RealPoseVerifier(new NullBackend());
    expect(v.available).toBe(false);
  });

  it('stop returns no scans when no frames were fed', async () => {
    const v = new RealPoseVerifier(new NullBackend());
    v.start(0);
    const scans = await v.stop();
    expect(scans).toEqual([]);
  });

  it('detects a left turn from fed frames and exposes quality after stop', async () => {
    const backend = new MediaPipeBackend();
    const v = new RealPoseVerifier(backend);
    expect(v.available).toBe(true);
    expect(v.engine).toContain('mediapipe');
    v.start(0);
    const yaws = [0, 0, -30, -40, -45, -40, -30, -10, 0];
    yaws.forEach((yaw, i) => {
      feedRawFrame(frameAt(i * 33, yaw));
    });
    const scans = await v.stop();
    expect(scans.length).toBeGreaterThanOrEqual(1);
    expect(scans[0]?.direction).toBe('left');
    const q = v.quality();
    expect(q).not.toBeNull();
    expect(q!.meanPoseConfidence).toBeGreaterThan(0);
  });

  it('drops frames while paused so scans do not span the gap', async () => {
    const backend = new MediaPipeBackend();
    const v = new RealPoseVerifier(backend);
    v.start(0);
    feedRawFrame(frameAt(0, 0));
    feedRawFrame(frameAt(33, 0));
    v.pause();
    // Would be a turn if live — must be ignored while paused.
    feedRawFrame(frameAt(66, -40));
    feedRawFrame(frameAt(99, -45));
    v.resume();
    feedRawFrame(frameAt(132, 0));
    const scans = await v.stop();
    expect(scans).toEqual([]);
  });
});
