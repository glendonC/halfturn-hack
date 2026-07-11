#!/usr/bin/env bash
#
# CI guard: fail if dev-build-only camera deps (react-native-vision-camera,
# react-native-mediapipe*, react-native-fast-tflite, react-native-worklets-core)
# leak into the Expo-Go-reachable graph. They are permitted ONLY inside the
# isolated, dynamically-imported backend files — keeping the Expo Go bundle
# clean so Phase-1 audio-only keeps running. See
# docs/phase-2-perception-architecture.md §4/§6.
#
set -euo pipefail

cd "$(dirname "$0")/.."

# Files allowed to reference camera/native-CV deps (dynamic-import isolated).
# Anchored to the exact path + extension (+ the grep -n trailing colon) so a
# lookalike-named file (e.g. CameraVerifierViewExtras.ts) can't slip a leak past.
ALLOW='(^|[: ])src/services/vision/(VisionPoseVerifier|CameraVerifierView|backends/MediaPipeBackend|backends/MoveNetTfliteBackend)\.tsx?:'
PATTERN='react-native-vision-camera|react-native-mediapipe|react-native-fast-tflite|react-native-worklets-core'

# Catch `... from '<dep>'`, bare side-effect `import '<dep>'`, and `require('<dep>')`.
# A bare side-effect import still EVALUATES the native module in the bundle, so it
# must be flagged. Dynamic `import('<dep>')` (no whitespace before the quote) is
# intentionally NOT matched — that's the safe, isolated pattern we rely on.
HITS="$(grep -rnE "(from|import)[[:space:]]+['\"](${PATTERN})|require\(['\"](${PATTERN})" app src 2>/dev/null | grep -vE "${ALLOW}" || true)"

if [ -n "${HITS}" ]; then
  echo "❌ Camera/native-CV deps imported outside the isolated backend files:"
  echo "${HITS}"
  echo ""
  echo "Move these imports into a dynamically-imported backend module so they"
  echo "never enter the Expo Go bundle."
  exit 1
fi

echo "✅ Expo Go bundle clean: no camera/native-CV imports outside isolated backends."
