#!/usr/bin/env bash
#
# Fetches the MediaPipe Pose Landmarker models into assets/models/. The
# react-native-mediapipe-posedetection config plugin bundles whatever .task files
# live under the configured assetsPaths (see app.json) into the native build, so
# these files must exist BEFORE `eas build` / `expo prebuild`. They are NOT committed
# (~5.5 MB + ~9 MB — kept out of git history); they are fetched on `npm install` (the
# `postinstall` hook), on EAS builds, and manually via `npm run fetch-model`.
# Idempotent: skips any variant already present.
#
# BOTH variants are fetched so the model becomes a runtime swap rather than a rebuild:
# the plugin copies every .task it finds into the bundle, and the pose library re-creates
# its detector when the model FILENAME changes. That is what lets an A/B field session run
# both arms off a single build. The variant list must stay in sync with POSE_MODELS in
# src/services/vision/poseModel.ts (bash cannot import TypeScript).
#
# Model card / license: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="assets/models"
BASE="https://storage.googleapis.com/mediapipe-models/pose_landmarker"
MIN_BYTES=1000000
VARIANTS=("pose_landmarker_lite" "pose_landmarker_full")

mkdir -p "$DEST"

for variant in "${VARIANTS[@]}"; do
  file="$DEST/${variant}.task"
  url="$BASE/${variant}/float16/latest/${variant}.task"

  if [ -f "$file" ] && [ "$(wc -c < "$file" | tr -d ' ')" -gt "$MIN_BYTES" ]; then
    echo "${variant}: present ($(wc -c < "$file" | tr -d ' ') bytes) — skipping"
    continue
  fi

  echo "Downloading ${variant}.task …"
  curl -fSL "$url" -o "$file"
  echo "Wrote $file ($(wc -c < "$file" | tr -d ' ') bytes)"
done
