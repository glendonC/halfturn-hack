import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass';
import { trackingLevel, type TrackingLevel } from '@/constants/visionTuning';
import {
  POSE_OVERLAY_IDX,
  type PoseOverlayFeed,
  type PoseOverlayFrame,
} from '@/services/vision';
import { glass, glassRadius, glassType, light, spacing } from '@/theme';
import { TRACKING_LEVEL_COLOR } from './TrackingRing';

/** Treat the subject as lost this long after frames stop arriving. */
const STALE_MS = 600;

/** What the vision pipeline currently recognizes, quantized to health buckets. */
interface SeenState {
  body: boolean;
  shoulders: TrackingLevel;
  hips: TrackingLevel;
}

const NOTHING_SEEN: SeenState = { body: false, shoulders: 'none', hips: 'none' };

function derive(frame: PoseOverlayFrame | null): SeenState {
  if (!frame) return NOTHING_SEEN;
  const v = (i: number) => frame.points[i]?.v ?? 0;
  return {
    body: true,
    shoulders: trackingLevel(Math.min(v(POSE_OVERLAY_IDX.lShoulder), v(POSE_OVERLAY_IDX.rShoulder))),
    hips: trackingLevel(Math.min(v(POSE_OVERLAY_IDX.lHip), v(POSE_OVERLAY_IDX.rHip))),
  };
}

const sameSeen = (a: SeenState, b: SeenState) =>
  a.body === b.body && a.shoulders === b.shoulders && a.hips === b.hips;

interface VisionChecklistProps {
  feed: PoseOverlayFeed;
  style?: StyleProp<ViewStyle>;
}

/**
 * Live "what vision sees" checklist for framing: Body / Shoulders / Hips, each
 * with a tracking-health dot (shoulders drive yaw, hips the turn discriminator —
 * the two signals calibration actually needs). Subscribes to the pose feed but
 * QUANTIZES to buckets before setState, so it re-renders only when a signal
 * changes bucket — never at frame rate.
 */
export function VisionChecklist({ feed, style }: VisionChecklistProps) {
  const [seen, setSeen] = useState<SeenState>(NOTHING_SEEN);
  const staleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = feed.subscribe((frame) => {
      const next = derive(frame);
      setSeen((prev) => (sameSeen(prev, next) ? prev : next));
      if (staleRef.current) clearTimeout(staleRef.current);
      if (frame) staleRef.current = setTimeout(() => setSeen(NOTHING_SEEN), STALE_MS);
    });
    return () => {
      unsubscribe();
      if (staleRef.current) clearTimeout(staleRef.current);
    };
  }, [feed]);

  return (
    <GlassSurface radius={glassRadius.pill} intensity="regular" fill={glass.fill} style={[styles.bar, style]}>
      <ChecklistItem label="Body" color={seen.body ? TRACKING_LEVEL_COLOR.good : TRACKING_LEVEL_COLOR.none} />
      <View style={styles.divider} />
      <ChecklistItem label="Shoulders" color={TRACKING_LEVEL_COLOR[seen.shoulders]} />
      <View style={styles.divider} />
      <ChecklistItem label="Hips" color={TRACKING_LEVEL_COLOR[seen.hips]} />
    </GlassSurface>
  );
}

function ChecklistItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...glassType.caption, color: light.inkSoft, fontWeight: '600' },
  divider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: light.hairline },
});
