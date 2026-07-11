# Models

`pose_landmarker_lite.task` (MediaPipe Pose Landmarker, **lite**) is **not committed**
— it's ~5.5 MB, so it's kept out of git history. It is fetched automatically:

- on `npm install` (the `postinstall` hook), and
- on EAS builds (same hook), and
- manually with `npm run fetch-model`.

The `react-native-mediapipe-posedetection` config plugin bundles whatever `.task`
files live in this directory into the native build (see `app.json` → `plugins`), so
the file must be present **before** `eas build` / `expo prebuild`.

Source + license: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
