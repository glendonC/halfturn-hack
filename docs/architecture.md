# Architecture

Opinionated map for the Expo / React Native app. Scaffold against this; do not invent parallel trees.

## What we measure

We verify **body/torso reorientation** (half-turn / scan timing), not “eyes swept the field.”

That honesty constraint shapes metrics, product copy, and validation. Camera verification answers: did the athlete reorient after the cue, and how fast? It does not claim gaze coverage of the pitch.

## Tech stack

| Concern | Choice | Why |
| ------- | ------ | --- |
| App | Expo SDK 54 + React Native 0.81 (New Arch) | Fast mobile MVP; Expo Go for audio |
| Navigation | Expo Router | Typed routes, tabs + stack |
| State | Zustand 5 | Small, local-first |
| Cue audio | expo-speech (TTS) | Offline, zero assets |
| Audio session | expo-audio | Duck music, play in silent mode |
| Persistence | expo-sqlite + kv-store | History + settings |
| Feedback | expo-haptics, expo-keep-awake | Eyes-free cues |
| Camera | VisionCamera + MediaPipe Pose | Dev build only; swappable backend |

TTS is behind an `AudioCueEngine` interface so a recorded voice-pack backend (`ClipCueEngine`) can drop in later without changing drill logic.

Perception is a **swappable backend**. Drill logic and UI never import MediaPipe directly. See [perception architecture](perception-architecture.md) and [Turn & React spec](turn-and-react-spec.md).

## Folder map

```
app/                         # Expo Router routes
  (tabs)/                    # Home / History / Stats / Profile
  drill/                     # Framing, active HUD, summary
src/
  types/                     # DrillConfig, CueEvent, DrillSession…
  theme/                     # Colors, spacing, glass tokens
  constants/                 # Cue catalog, defaults, visionTuning
  state/                     # Zustand stores
  hooks/                     # Brightness, orientation helpers
  services/
    audio/                   # AudioCueEngine + TTS / clip engines
    db/                      # SQLite + sessions repo
    drill/                   # Scheduler + useDrillEngine + modes
    vision/                  # PoseVerifier seam, scan detect, backends
  components/
    drill/                   # Cue displays and layouts
    camera/                  # Overlay UI (no native imports)
    glass/                   # Liquid glass chrome
```

Camera-mode UI boundaries: [field UI module map](field-ui-module-map.md).

## How a drill works

1. Setup edits the persisted `DrillConfig`.
2. Start navigates to `drill/active`, which calls `useDrillEngine()`.
3. The engine snapshots config, warms TTS, configures the audio session, runs countdown, then drives a 250 ms tick loop.
4. Each tick, the pure `CueScheduler` picks the next cue; the engine interrupts in-flight speech, speaks, fires haptics, and records a `CueEvent` (wall-clock + drill-monotonic timestamps).
5. On finish, it builds a `DrillSession` and persists it to SQLite. Summary reads it back.

## Key design decisions

- **Pure scheduler.** `CueScheduler` is pure over a seedable RNG. `useDrillEngine` owns side effects.
- **Cues interrupt, not queue.** Stop speech before each cue; floor intervals at estimated utterance length.
- **Two clocks on every cue.** Wall-clock and drill-monotonic. Camera reaction time subtracts on the monotonic axis.
- **Forward-compatible data model.** `cue_events`, nullable `verification`, string IDs, and unused sync columns ship now so camera verification and future sync stay additive.
- **Camera is a lazy seam.** Vision exports types, pure scan detection, `PoseVerifier`, and a null verifier. Native modules load only behind `EXPO_PUBLIC_VISION`.

## Known limitations (audio path)

- TTS voice quality varies by device; in-app volume is best-effort on iOS (use device volume).
- Audio is foreground-only. Keep the screen awake; cues do not play when backgrounded.
- Native pose needs a custom dev build. See [Getting started](getting-started.md).
