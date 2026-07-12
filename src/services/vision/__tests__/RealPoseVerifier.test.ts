import type {
  BackendStartConfig,
  Landmark,
  Landmark3D,
  PerceptionBackend,
  RawPoseFrame,
} from '../PerceptionBackend';
import { RealPoseVerifier } from '../RealPoseVerifier';
import type { CalibrationProfile } from '../types';

const L_SHOULDER = 11;
const R_SHOULDER = 12;

const NEUTRAL: CalibrationProfile = { neutralYawBaselineDeg: 0, yawSign: 1, capturedAtEpochMs: 0 };

/**
 * Build a frame whose shoulder world-vector yields ~`yawDeg` of torso yaw:
 * with shoulders at x = ∓0.2 (so sx = 0.4), atan2(rz, sx) = yawDeg ⇒
 * rz = 0.4·tan(yawDeg).
 */
function frameAt(captureClockMs: number, yawDeg: number, conf = 0.9): RawPoseFrame {
  const sx = 0.4;
  const rz = sx * Math.tan((yawDeg * Math.PI) / 180);
  const world: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  world[L_SHOULDER] = { x: -0.2, y: 0, z: 0 };
  world[R_SHOULDER] = { x: 0.2, y: 0, z: rz };
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  const visibility = new Array(33).fill(0);
  visibility[L_SHOULDER] = conf;
  visibility[R_SHOULDER] = conf;
  return { captureClockMs, landmarks, world, visibility, modelId: 'fake' };
}

/** A PerceptionBackend whose frames are driven manually by the test. */
class FakeBackend implements PerceptionBackend {
  readonly id = 'fake';
  readonly version = '1';
  private cb: ((raw: RawPoseFrame) => void) | null = null;
  async available(): Promise<boolean> {
    return true;
  }
  start(_cfg?: BackendStartConfig): void {}
  onRawPose(cb: (raw: RawPoseFrame) => void): void {
    this.cb = cb;
  }
  stop(): void {}
  emit(raw: RawPoseFrame): void {
    this.cb?.(raw);
  }
}

// 0 → -45 → 0 left half-turn over 9 samples; peak (|yaw|=45) at index 4.
const LEFT_TURN_YAWS = [0, 0, -30, -40, -45, -40, -30, -10, 0];

describe('RealPoseVerifier — clock anchoring', () => {
  it('maps the first frame to the drill-clock origin (scans land on the cue axis, not the capture epoch)', async () => {
    const backend = new FakeBackend();
    const v = new RealPoseVerifier(backend, NEUTRAL);
    v.start(0);

    const base = 1_700_000_000_000; // epoch-scale capture clock (Date-based, as MediaPipe stamps)
    LEFT_TURN_YAWS.forEach((yaw, i) => backend.emit(frameAt(base + i * 40, yaw)));
    const scans = await v.stop();

    expect(scans).toHaveLength(1);
    expect(scans[0].direction).toBe('left');
    // Peak is frame index 4 → 160ms after the first frame, NOT ~1.7e12.
    expect(scans[0].tMonoMs).toBe(160);
    expect(scans[0].startMonoMs).toBe(80); // first frame past the enter threshold (index 2)
  });
});

describe('RealPoseVerifier — pause/resume', () => {
  it('drops frames while paused and re-anchors on resume so paused time is excluded', async () => {
    const backend = new FakeBackend();
    const v = new RealPoseVerifier(backend, NEUTRAL);
    v.start(0);

    const base = 5_000;
    // 3 live neutral frames → tMono 0, 40, 80.
    [0, 40, 80].forEach((dt) => backend.emit(frameAt(base + dt, 0)));

    v.pause();
    // A full turn DURING the pause — must be dropped (no phantom scan).
    LEFT_TURN_YAWS.forEach((yaw, i) => backend.emit(frameAt(base + 120 + i * 40, yaw)));
    const resumeBase = base + 10_000; // 10s of wall-clock elapsed while paused
    v.resume();

    // A real turn after resume.
    LEFT_TURN_YAWS.forEach((yaw, i) => backend.emit(frameAt(resumeBase + i * 40, yaw)));
    const scans = await v.stop();

    expect(scans).toHaveLength(1); // only the post-resume turn; the paused turn is dropped
    expect(scans[0].direction).toBe('left');
    // Re-anchored: tMono continues from where live sampling left off (~80ms),
    // excluding the 10s pause — NOT ~10000+. (Concretely: 280ms.)
    expect(scans[0].tMonoMs).toBeGreaterThan(0);
    expect(scans[0].tMonoMs).toBeLessThan(1000);
  });

  it('keeps no-op pause/resume safe before any frame', async () => {
    const backend = new FakeBackend();
    const v = new RealPoseVerifier(backend, NEUTRAL);
    v.start(0);
    v.pause();
    v.resume();
    const scans = await v.stop();
    expect(scans).toHaveLength(0);
  });
});

describe('RealPoseVerifier — live scan feed', () => {
  it('emits a completed scan DURING the run, before stop()', async () => {
    const backend = new FakeBackend();
    const v = new RealPoseVerifier(backend, NEUTRAL);
    const live: string[] = [];
    v.onScan((scan) => live.push(scan.direction));
    v.start(0);

    const base = 5_000;
    LEFT_TURN_YAWS.forEach((yaw, i) => backend.emit(frameAt(base + i * 40, yaw)));
    // Post-turn neutral padding so a throttled detection pass runs after the exit.
    [9, 10, 11].forEach((i) => backend.emit(frameAt(base + i * 40, 0)));

    expect(live).toEqual(['left']); // fired live, before stop
    const scans = await v.stop();
    expect(scans).toHaveLength(1); // and the authoritative timeline agrees
  });

  it('never emits the same scan twice', async () => {
    const backend = new FakeBackend();
    const v = new RealPoseVerifier(backend, NEUTRAL);
    const live: number[] = [];
    v.onScan((scan) => live.push(scan.tMonoMs));
    v.start(0);

    const base = 5_000;
    LEFT_TURN_YAWS.forEach((yaw, i) => backend.emit(frameAt(base + i * 40, yaw)));
    // A long neutral tail → many further detection passes over the same scan.
    for (let i = 9; i < 24; i += 1) backend.emit(frameAt(base + i * 40, 0));

    expect(live).toHaveLength(1);
  });
});
