#!/usr/bin/env bash
#
# Idempotent native patch applied after `npm install` (postinstall) and re-runnable by hand.
# It fixes third-party pods whose sources don't build under our pinned
# `expo-build-properties → ios.useFrameworks: "static"` (required by
# react-native-mediapipe-posedetection; see the camera-devbuild-state memory). Lives here (not
# patch-package) to add no dependency and to match the existing idempotent-postinstall pattern
# (scripts/fetch-pose-model.sh). Always exits 0 so a missing/unpatched dep never breaks install.
#
# Patch 1 — MediapipePosedetection.mm imports the Swift-generated header with the QUOTE form
# (`#import "MediapipePosedetection-Swift.h"`), which does not resolve when the pod is built as a
# static framework (`use_frameworks! :linkage => :static`). Under frameworks the same-module Swift
# header is only reachable via the ANGLE form `<Module/Module-Swift.h>`. Guard it with
# `__has_include` so it works both with and without frameworks.
set -uo pipefail
cd "$(dirname "$0")/.."

patch_mediapipe_swift_header() {
  local file="node_modules/react-native-mediapipe-posedetection/ios/MediapipePosedetection.mm"
  [ -f "$file" ] || { echo "patch-native: mediapipe pod not present — skipping"; return 0; }
  if grep -q '__has_include(<MediapipePosedetection/MediapipePosedetection-Swift.h>)' "$file"; then
    echo "patch-native: mediapipe -Swift.h import already guarded — skipping"
    return 0
  fi
  perl -0pi -e 's{#import "MediapipePosedetection-Swift\.h"}{#if __has_include(<MediapipePosedetection/MediapipePosedetection-Swift.h>)\n#import <MediapipePosedetection/MediapipePosedetection-Swift.h>\n#else\n#import "MediapipePosedetection-Swift.h"\n#endif}' "$file"
  echo "patch-native: guarded mediapipe -Swift.h import for static frameworks"
}

patch_mediapipe_swift_header
exit 0
