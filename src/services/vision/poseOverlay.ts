/**
 * Pose-overlay presentation feed — the pure data path behind the framing
 * screen's "connect the dots" skeleton and recognition checklist.
 *
 * `CameraVerifierView` converts each detection into VIEW-space points using the
 * pose library's ViewCoordinator (which owns the rotation / mirror / cover-crop
 * math) and publishes them here; overlay components subscribe and own their own
 * ~15fps re-renders so the frames never pass through screen-level state.
 *
 * Structural (duck) types only — the CI guard forbids ANY import from the pose
 * package outside the isolated backend files, so the converter interface is
 * declared shape-compatible with the library's ViewCoordinator instead.
 */

import { OneEuroFilter, type OneEuroConfig } from './OneEuroFilter';

/** One landmark in VIEW coordinates (px within the camera view). */
export interface PoseViewPoint {
  x: number;
  y: number;
  /** Landmark visibility 0..1 — drives dot/segment opacity + the checklist. */
  v: number;
}

/** One converted detection; `points` aligns with POSE_OVERLAY_LANDMARKS. */
export interface PoseOverlayFrame {
  points: (PoseViewPoint | null)[];
}

/**
 * The drawn landmark subset (MediaPipe BlazePose indices): face anchor
 * (ears–nose), arms, shoulder/hip lines, legs. Deliberately NOT all 33 points —
 * enough to read "the camera sees my body" without becoming decorative noise.
 */
export const POSE_OVERLAY_LANDMARKS = [
  0, // nose
  7, // left ear
  8, // right ear
  11, // left shoulder
  12, // right shoulder
  13, // left elbow
  14, // right elbow
  15, // left wrist
  16, // right wrist
  23, // left hip
  24, // right hip
  25, // left knee
  26, // right knee
  27, // left ankle
  28, // right ankle
] as const;

/** Named positions INTO the subset above (for checklist derivations). */
export const POSE_OVERLAY_IDX = {
  nose: 0,
  lEar: 1,
  rEar: 2,
  lShoulder: 3,
  rShoulder: 4,
  lElbow: 5,
  rElbow: 6,
  lWrist: 7,
  rWrist: 8,
  lHip: 9,
  rHip: 10,
  lKnee: 11,
  rKnee: 12,
  lAnkle: 13,
  rAnkle: 14,
} as const;

/** Skeleton segments as pairs of subset positions ("connect the dots"). */
export const POSE_OVERLAY_EDGES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 2], // ear – nose – ear
  [3, 4], // shoulder line
  [3, 5],
  [5, 7], // left arm
  [4, 6],
  [6, 8], // right arm
  [3, 9],
  [4, 10],
  [9, 10], // torso + hip line
  [9, 11],
  [11, 13], // left leg
  [10, 12],
  [12, 14], // right leg
];

/** Shape-compatible slice of the pose library's ViewCoordinator. */
export interface OverlayViewConverter {
  convertPoint: (
    frame: { width: number; height: number },
    p: { x: number; y: number },
  ) => { x: number; y: number };
}

/**
 * Map normalized image landmarks to view-space overlay points via the library's
 * converter (rotation + mirror + cover-crop handled there). Pure; null entries
 * mark landmarks the model didn't produce or that converted to non-finite.
 */
export function landmarksToOverlayFrame(
  landmarks: readonly { x: number; y: number; visibility?: number }[],
  frameDims: { width: number; height: number },
  vc: OverlayViewConverter,
): PoseOverlayFrame {
  const points = POSE_OVERLAY_LANDMARKS.map((i) => {
    const l = landmarks[i];
    if (!l) return null;
    const p = vc.convertPoint(frameDims, { x: l.x, y: l.y });
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: p.x, y: p.y, v: l.visibility ?? 0 };
  });
  return { points };
}

/**
 * One-Euro tuning for VIEW-space pixels at the plugin's ~15fps: minCutoff kills
 * the standing-still jitter; landmark speeds are hundreds of px/s during a turn,
 * so a small beta already lifts the cutoff enough to keep fast motion tight.
 */
export const OVERLAY_SMOOTHING: OneEuroConfig = {
  minCutoff: 1.2,
  beta: 0.01,
  dCutoff: 1.0,
};

/** Stateful per-landmark smoother for the overlay feed (presentation only). */
export interface PoseOverlaySmoother {
  /** Smooth one converted frame stamped at `tMs`; pass `null` to reset on lost pose. */
  smooth(frame: PoseOverlayFrame | null, tMs: number): PoseOverlayFrame | null;
}

/**
 * Per-landmark One-Euro smoothing of the drawn skeleton. PRESENTATION ONLY —
 * this never touches the RawPoseFrame path, so yaw/scan metrics are unaffected
 * and its timestamps only need to be monotonic, not on the drill clock.
 * A landmark's filter resets whenever that landmark (or the whole pose) drops
 * out, so a re-acquired point snaps to its real position instead of smearing
 * in from where it was last seen.
 */
export function createPoseOverlaySmoother(
  cfg: OneEuroConfig = OVERLAY_SMOOTHING,
): PoseOverlaySmoother {
  const filters: ({ x: OneEuroFilter; y: OneEuroFilter } | null)[] =
    POSE_OVERLAY_LANDMARKS.map(() => null);
  return {
    smooth(frame, tMs) {
      if (!frame) {
        filters.fill(null);
        return null;
      }
      const points = frame.points.map((p, i) => {
        if (!p) {
          filters[i] = null;
          return null;
        }
        let f = filters[i];
        if (!f) {
          f = { x: new OneEuroFilter(cfg), y: new OneEuroFilter(cfg) };
          filters[i] = f;
        }
        return { x: f.x.filter(p.x, tMs), y: f.y.filter(p.y, tMs), v: p.v };
      });
      return { points };
    },
  };
}

/**
 * Tiny multi-subscriber feed: the camera publishes, overlay components
 * subscribe. `null` frames mean "no pose this frame" (subject lost); consumers
 * also apply their own staleness timeout in case frames stop arriving entirely.
 */
export interface PoseOverlayFeed {
  publish: (frame: PoseOverlayFrame | null) => void;
  subscribe: (cb: (frame: PoseOverlayFrame | null) => void) => () => void;
}

export function createPoseOverlayFeed(): PoseOverlayFeed {
  const subs = new Set<(frame: PoseOverlayFrame | null) => void>();
  return {
    publish: (frame) => {
      for (const cb of subs) cb(frame);
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
