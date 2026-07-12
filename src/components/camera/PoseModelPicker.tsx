import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  POSE_MODELS,
  POSE_MODEL_IDS,
  VISION_ENABLED,
  usePoseModelStore,
  type PoseModelId,
} from '@/services/vision';
import { colors, typography } from '@/theme';

const ENABLED = __DEV__ && VISION_ENABLED;

interface PoseModelPickerProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * DEV-ONLY pose-variant switch, for running a lite-vs-full A/B in the field.
 *
 * Both `.task` files are bundled (see scripts/fetch-pose-model.sh + app.json `assetsPaths`)
 * and the pose library re-creates its detector when the model FILENAME changes — so tapping
 * here swaps the running net live, with no rebuild and no Metro restart. That is what lets one
 * field session alternate arms (lite → full → lite → full) so thermal drift and fatigue cancel
 * out of the comparison.
 *
 * Renders nothing unless `__DEV__ && VISION_ENABLED`, so production has no way to change the
 * model and always runs DEFAULT_POSE_MODEL.
 */
export function PoseModelPicker({ style }: PoseModelPickerProps) {
  const active = usePoseModelStore((s) => s.modelId);
  const setModel = usePoseModelStore((s) => s.setModel);

  if (!ENABLED) return null;

  return (
    <View style={[styles.wrap, style]}>
      {POSE_MODEL_IDS.map((id: PoseModelId) => {
        const spec = POSE_MODELS[id];
        const on = id === active;
        return (
          <Pressable
            key={id}
            onPress={() => setModel(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Pose model ${id}`}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.text, on && styles.textOn]}>
              {id} · {spec.approxSizeMb}MB
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(7,10,14,0.72)',
  },
  chipOn: { backgroundColor: colors.primary },
  text: { ...typography.caption, color: colors.primary },
  textOn: { color: '#070A0E', fontWeight: '700' },
});
