import {
  POSE_OVERLAY_EDGES,
  POSE_OVERLAY_IDX,
  POSE_OVERLAY_LANDMARKS,
  createPoseOverlayFeed,
  createPoseOverlaySmoother,
  landmarksToOverlayFrame,
  type OverlayViewConverter,
  type PoseOverlayFrame,
} from '../poseOverlay';

/** Identity-ish converter: denormalize into a 100×200 view, no mirror/rotate. */
const vc: OverlayViewConverter = {
  convertPoint: (frame, p) => ({ x: p.x * frame.width, y: p.y * frame.height }),
};
const FRAME = { width: 100, height: 200 };

/** Full 33-landmark list with every point at (0.5, 0.25), visibility 0.9. */
const fullLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.25, visibility: 0.9 }));

describe('landmarksToOverlayFrame', () => {
  it('maps the drawn subset into view space, in subset order', () => {
    const frame = landmarksToOverlayFrame(fullLandmarks, FRAME, vc);
    expect(frame.points).toHaveLength(POSE_OVERLAY_LANDMARKS.length);
    for (const p of frame.points) {
      expect(p).toEqual({ x: 50, y: 50, v: 0.9 });
    }
  });

  it('marks missing and non-finite landmarks as null', () => {
    const partial = fullLandmarks.slice(0, 12); // shoulders present, hips/legs absent
    const frame = landmarksToOverlayFrame(partial, FRAME, vc);
    expect(frame.points[POSE_OVERLAY_IDX.lShoulder]).not.toBeNull();
    expect(frame.points[POSE_OVERLAY_IDX.lHip]).toBeNull();
    expect(frame.points[POSE_OVERLAY_IDX.rAnkle]).toBeNull();

    const nan = fullLandmarks.map(() => ({ x: Number.NaN, y: 0.5, visibility: 1 }));
    expect(landmarksToOverlayFrame(nan, FRAME, vc).points.every((p) => p === null)).toBe(true);
  });

  it('defaults absent visibility to 0 (hidden, not confident)', () => {
    const noVis = fullLandmarks.map(({ x, y }) => ({ x, y }));
    const frame = landmarksToOverlayFrame(noVis, FRAME, vc);
    expect(frame.points[POSE_OVERLAY_IDX.nose]?.v).toBe(0);
  });
});

describe('pose overlay skeleton table', () => {
  it('edges reference valid subset positions', () => {
    for (const [a, b] of POSE_OVERLAY_EDGES) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(POSE_OVERLAY_LANDMARKS.length);
      expect(b).toBeLessThan(POSE_OVERLAY_LANDMARKS.length);
      expect(a).not.toBe(b);
    }
  });

  it('named positions agree with the subset ordering', () => {
    expect(POSE_OVERLAY_LANDMARKS[POSE_OVERLAY_IDX.lShoulder]).toBe(11);
    expect(POSE_OVERLAY_LANDMARKS[POSE_OVERLAY_IDX.rShoulder]).toBe(12);
    expect(POSE_OVERLAY_LANDMARKS[POSE_OVERLAY_IDX.lHip]).toBe(23);
    expect(POSE_OVERLAY_LANDMARKS[POSE_OVERLAY_IDX.rHip]).toBe(24);
  });
});

describe('createPoseOverlaySmoother', () => {
  /** A frame with every drawn landmark at (x, y), visibility 0.9. */
  const frameAt = (x: number, y: number): PoseOverlayFrame => ({
    points: POSE_OVERLAY_LANDMARKS.map(() => ({ x, y, v: 0.9 })),
  });

  it('passes the first sample through and damps jitter afterwards', () => {
    const smoother = createPoseOverlaySmoother();
    const first = smoother.smooth(frameAt(50, 50), 0)!;
    expect(first.points[0]).toEqual({ x: 50, y: 50, v: 0.9 });

    // A one-frame 10px spike at ~15fps should come out well under 10px.
    const spiked = smoother.smooth(frameAt(60, 50), 66)!;
    const p = spiked.points[0]!;
    expect(p.x).toBeGreaterThan(50);
    expect(p.x).toBeLessThan(58);
    expect(p.y).toBe(50);
  });

  it('echoes visibility unfiltered', () => {
    const smoother = createPoseOverlaySmoother();
    smoother.smooth(frameAt(50, 50), 0);
    const out = smoother.smooth(
      { points: POSE_OVERLAY_LANDMARKS.map(() => ({ x: 50, y: 50, v: 0.4 })) },
      66,
    )!;
    expect(out.points[0]?.v).toBe(0.4);
  });

  it('resets a landmark that drops out, so it re-acquires without smearing', () => {
    const smoother = createPoseOverlaySmoother();
    smoother.smooth(frameAt(50, 50), 0);

    const dropped = frameAt(50, 50);
    dropped.points[POSE_OVERLAY_IDX.nose] = null;
    expect(smoother.smooth(dropped, 66)!.points[POSE_OVERLAY_IDX.nose]).toBeNull();

    // Reappears far away: a fresh filter passes it through, no interpolation.
    const back = smoother.smooth(frameAt(90, 20), 133)!;
    expect(back.points[POSE_OVERLAY_IDX.nose]).toEqual({ x: 90, y: 20, v: 0.9 });
  });

  it('resets everything on a null frame (lost pose)', () => {
    const smoother = createPoseOverlaySmoother();
    smoother.smooth(frameAt(50, 50), 0);
    expect(smoother.smooth(null, 66)).toBeNull();
    const back = smoother.smooth(frameAt(90, 20), 133)!;
    expect(back.points[0]).toEqual({ x: 90, y: 20, v: 0.9 });
  });
});

describe('createPoseOverlayFeed', () => {
  it('fans out to every subscriber and honors unsubscribe', () => {
    const feed = createPoseOverlayFeed();
    const a: (PoseOverlayFrame | null)[] = [];
    const b: (PoseOverlayFrame | null)[] = [];
    const offA = feed.subscribe((f) => a.push(f));
    feed.subscribe((f) => b.push(f));

    const frame = landmarksToOverlayFrame(fullLandmarks, FRAME, vc);
    feed.publish(frame);
    feed.publish(null);
    offA();
    feed.publish(frame);

    expect(a).toEqual([frame, null]);
    expect(b).toEqual([frame, null, frame]);
  });
});
