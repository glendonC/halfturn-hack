import {
  POSE_OVERLAY_EDGES,
  POSE_OVERLAY_IDX,
  POSE_OVERLAY_LANDMARKS,
  createPoseOverlayFeed,
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
