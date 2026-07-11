#!/usr/bin/env bash
#
# Fetches the MediaPipe Pose Landmarker (lite) model into assets/models/. The
# react-native-mediapipe-posedetection config plugin bundles whatever .task files
# live under the configured assetsPaths (see app.json) into the native build, so
# this file must exist BEFORE `eas build` / `expo prebuild`. It is NOT committed
# (~5.5 MB — kept out of git history); it is fetched on `npm install` (the
# `postinstall` hook), on EAS builds, and manually via `npm run fetch-model`.
# Idempotent: skips the download if a valid copy is already present.
#
# Model card / license: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="assets/models"
FILE="$DEST/pose_landmarker_lite.task"
URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"

if [ -f "$FILE" ] && [ "$(wc -c < "$FILE" | tr -d ' ')" -gt 1000000 ]; then
  echo "pose model already present ($(wc -c < "$FILE" | tr -d ' ') bytes) — skipping download"
  exit 0
fi

mkdir -p "$DEST"
echo "Downloading pose_landmarker_lite.task …"
curl -fSL "$URL" -o "$FILE"
echo "Wrote $FILE ($(wc -c < "$FILE" | tr -d ' ') bytes)"
