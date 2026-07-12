import { Fragment, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import {
  POSE_OVERLAY_EDGES,
  type PoseOverlayFeed,
  type PoseOverlayFrame,
} from '@/services/vision';

/** Clear the skeleton this long after frames stop (subject lost / camera off). */
const STALE_MS = 600;
/** Hide dots/segments the model is merely guessing at (occluded landmarks). */
const MIN_VISIBILITY = 0.35;
/** Fully-visible landmark opacity ramp: v is mapped 0.35..1 → 0..1 then eased. */
const opacityFor = (v: number) => Math.min(1, Math.max(0, (v - MIN_VISIBILITY) / (1 - MIN_VISIBILITY)));

interface PoseOverlayProps {
  /** The camera's per-frame view-space skeleton feed. */
  feed: PoseOverlayFeed;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Connect the dots" pose skeleton drawn over the framing camera — live proof
 * of exactly what the vision pipeline sees. Segments/dots fade with landmark
 * visibility, so a cut-off body part visibly drops out (that IS the feedback —
 * step back / re-frame). Owns its own ~15fps state via the feed subscription,
 * so per-frame updates never re-render the screen around it.
 *
 * Glass language: frosted-white strokes with a faint ink underlay for
 * definition on bright scenes — informational, not decorative.
 */
export function PoseOverlay({ feed, style }: PoseOverlayProps) {
  const [frame, setFrame] = useState<PoseOverlayFrame | null>(null);
  const staleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = feed.subscribe((f) => {
      setFrame(f);
      if (staleRef.current) clearTimeout(staleRef.current);
      if (f) staleRef.current = setTimeout(() => setFrame(null), STALE_MS);
    });
    return () => {
      unsubscribe();
      if (staleRef.current) clearTimeout(staleRef.current);
    };
  }, [feed]);

  if (!frame) return null;
  const pts = frame.points;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg style={StyleSheet.absoluteFill}>
        {POSE_OVERLAY_EDGES.map(([a, b], i) => {
          const pa = pts[a];
          const pb = pts[b];
          if (!pa || !pb) return null;
          const v = Math.min(pa.v, pb.v);
          if (v < MIN_VISIBILITY) return null;
          const o = opacityFor(v);
          return (
            <Fragment key={`e${i}`}>
              {/* Ink underlay so the white stroke stays defined on bright video. */}
              <Line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(24,20,37,0.30)"
                strokeWidth={4.5}
                strokeLinecap="round"
                opacity={o}
              />
              <Line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={o}
              />
            </Fragment>
          );
        })}
        {pts.map((p, i) => {
          if (!p || p.v < MIN_VISIBILITY) return null;
          return (
            <Circle
              key={`p${i}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="rgba(255,255,255,0.95)"
              stroke="rgba(24,20,37,0.35)"
              strokeWidth={1.25}
              opacity={opacityFor(p.v)}
            />
          );
        })}
      </Svg>
    </View>
  );
}
