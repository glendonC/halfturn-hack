# HalfTurn ⚽️

**A solo scanning & awareness trainer for soccer players.**

HalfTurn is a virtual coach in your headphones. It calls out randomized cues —
_“Check left”, “Man on”, “Turn”, “Scan”, “Open body”_ — while you train with a
ball, so you can practice **shoulder-checking, scanning, and reacting to cues**
without a coach or teammate calling them out.

This repo is the **audio-cue drill**: a local-first, offline mobile app you can test
on a real field this week. Camera-based verification of your actual scans is the
**turn-and-react camera mode** (designed here — see [ROADMAP.md](./ROADMAP.md)).

---

## Features (audio-cue drill)

- **Drill setup** — duration, random cue interval range, which cue types to use,
  left/right balance, spoken countdown, repeat avoidance.
- **Active drill HUD** — huge color-flooded cue, big countdown timer, eyes-free
  haptics on every cue, pause/resume/stop. Built to be readable from a glance
  while you’re moving.
- **Spoken cues via text-to-speech** — zero audio assets, fully offline. Cues
  _interrupt_ cleanly so they always fire on time; the `Color` and `Number` cues
  speak a random value (e.g. “Red”, “7”).
- **Pre-drill audio check** — test sound + a spoken 3-2-1 countdown that warms up
  the speech engine, so the first cue isn’t late or silent.
- **History** — every session’s date, duration, cue count and cue distribution,
  stored locally in SQLite.
- **Settings** — volume, voice speed/pitch, headphone vs speaker mix, cue
  vocabulary, haptics, keep-awake, clear history.

Everything runs in **Expo Go** on **Expo SDK 54** (React Native 0.81, New
Architecture) — no native build required for the audio-only build.

> **Turn & React status:** the camera-verified "turn-and-react" mode is
> implemented (mode toggle on Train, on-screen cue surface, on-device
> MediaPipe pose verification). The audio drill still runs in Expo Go; the camera
> mode needs a **custom dev build** (see [ROADMAP.md](./ROADMAP.md) and
> [`docs/turn-and-react-spec.md`](./docs/turn-and-react-spec.md)). In Expo Go,
> Turn & React runs as a beep-only preview with `verification` left null.

---

## Tech stack

| Concern        | Choice                                   | Why |
| -------------- | ---------------------------------------- | --- |
| App framework  | **Expo SDK 54 + React Native 0.81 (New Arch)** | Modern, Expo-Go-runnable |
| Navigation     | **Expo Router** (file-based)             | Typed routes, simple tabs + stack |
| State          | **Zustand 5**                            | Tiny, no boilerplate |
| Cue audio      | **expo-speech** (TTS)                     | Offline, zero assets, instant |
| Audio session  | **expo-audio** `setAudioModeAsync`        | Duck music, play in silent mode |
| Persistence    | **expo-sqlite** (history) + **kv-store** (settings) | One dependency for both |
| Feedback       | **expo-haptics**, **expo-keep-awake**     | Eyes-free cues, screen stays on |
| Controls       | **@react-native-community/slider**        | Interval / volume / balance |
| Camera         | **VisionCamera v4 + MediaPipe Pose (lite, GPU)** | Built; runs in a **dev build** (see below), not Expo Go |

> Why TTS instead of recorded clips? It’s zero-asset, offline, and instantly
> testable. The audio engine is behind an `AudioCueEngine` interface, so a
> recorded **voice-pack** backend (`ClipCueEngine`) can drop in later with no
> changes to the drill logic.

---

## Getting started

### Prerequisites

- **Node 18+** (tested on Node 24)
- The **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), _or_ an iOS Simulator / Android Emulator.

### Install & run

```bash
npm install
npm start            # starts the Expo dev server + QR code
```

Then:

- **On your phone:** scan the QR code with Expo Go.
- **iOS Simulator:** press `i` · **Android Emulator:** press `a`.

Other scripts:

```bash
npm run ios          # open in iOS Simulator
npm run android      # open in Android Emulator
npm run typecheck    # tsc --noEmit
npm run fix-deps     # expo install --fix (re-pin deps to the SDK)
```

### ⚠️ iOS audio note (important for field testing)

On iPhone, **turn the silent/ringer switch OFF** before a drill, and use the
hardware volume buttons to set loudness — iOS often ignores in-app TTS volume and
silences audio when the ringer switch is on. The app’s **“Test sound”** button on
the Ready screen lets you confirm you can hear cues before you start.

---

## Turn & React (camera-verified) — dev build

The audio drill runs in Expo Go. **Turn & React** adds on-device pose CV
(VisionCamera v4 + MediaPipe Pose) to verify your actual half-turns, so it needs
a **custom dev build** on a **physical device** (the camera can’t run in Expo Go
or the simulator). In Expo Go, Turn & React still runs as a **beep-only preview**
(no camera, `verification` stays null).

### Build & run on a physical iPhone

```bash
npm install                 # postinstall fetches the pose model (assets/models/…)
npm run fetch-model         # (if the model wasn't fetched) confirm it's present

# One-time: build the dev client (installs on your device). EXPO_PUBLIC_VISION=1
# is baked in by eas.json's `development` profile — that flag is what enables the
# camera pipeline; without it the app resolves the no-op verifier.
eas build --profile development --platform ios

# Then run the JS against the installed dev client:
npx expo start --dev-client
```

Local alternative (Mac + Xcode, no EAS):

```bash
EXPO_PUBLIC_VISION=1 npx expo run:ios --device   # build & install on a wired iPhone
```

> **Why a dev build?** `react-native-vision-camera` + `react-native-mediapipe-posedetection`
> are native modules. They’re isolated behind a dynamic import and the
> `EXPO_PUBLIC_VISION` flag, and `npm run guard:expo-go` (CI) fails if they ever
> leak into the Expo-Go graph — so the audio-only build stays Expo-Go-runnable.

### Field-test checklist (outdoors, with a ball)

1. **Mount** the phone ~2–4 m away, **front camera facing you**, screen toward you
   (tripod/bag). Stand with your **back/shoulder to the camera** in neutral.
2. **Setup → Mode → Turn & react → “Set up camera.”** Grant camera permission.
3. **Framing:** back to the phone → *Capture center*; turn **left** → *Capture
   left turn*. The pill turns green when you’re solidly in frame. (“Use last
   setup” skips this next time.)
4. **Drill:** watch the full-screen cue; on each **beep**, half-turn to read the
   color / number / instruction, then reset. The bottom-right **self-view
   squircle** shows a live tracking ring (green = solid, yellow = weak, red =
   lost) — keep it green.
5. **Summary:** confirm **Scan verification** shows non-null turns / reaction time
   when you actually turned. If metrics look off, re-check framing and lighting.
6. Optional in **Settings → Field display**: *Boost brightness* (outdoor
   readability) and *Landscape in Turn & React* (bigger cue at distance).
7. **Dev diagnostics:** a dev build shows a small `fps · conf · frames · ms`
   overlay top-left during the drill — use it to sanity-check effective fps
   (~15 on stock) and mean tracking confidence.

> **Known native limits (stock package):** the pose plugin caps at ~15 fps and
> exposes no capture timestamp, so reaction time carries a small, *calibratable*
> bias. Ship stock, measure on-device, and only patch native if the reaction-time
> metric is unusable. See [`docs/perception-architecture.md`](./docs/perception-architecture.md).

---

## Project structure

```
app/                         # Expo Router routes
  _layout.tsx                # Root: DB init, audio session, splash, Stack
  (tabs)/
    _layout.tsx              # Train / History / Settings tabs
    index.tsx                # Drill setup
    history.tsx              # Session history
    settings.tsx             # Settings
  drill/
    active.tsx               # Ready → countdown → running HUD
    summary.tsx              # Post-drill recap
src/
  types/                     # Domain types (DrillConfig, CueEvent, DrillSession…)
  theme/                     # Colors, spacing, typography tokens
  constants/                 # Cue catalog + defaults/bounds + visionTuning (thresholds)
  state/                     # Zustand stores (settings, drill-config, runtime)
  hooks/                     # useDrillBrightness, useTurnReactOrientation (opt-in field ergonomics)
  services/
    audio/                   # AudioCueEngine + TTS impl + audio-session config
    db/                      # SQLite open/migrate + sessions repository
    drill/                   # Pure CueScheduler + useDrillEngine hook
      modes/                 # DrillModeBehavior strategy (audio vs turn-react); engine delegates
    vision/                  # PoseVerifier seam + pure scan detection / YawFusion / diagnostics
      backends/              # Swappable PerceptionBackend (MediaPipe today) — native, dynamic-import-only
  components/
    drill/                   # Cue displays, layouts (Audio HUD / Turn-React FaceTime), Ready/Countdown
    camera/                  # CameraSquircle + TrackingRing + VisionDiagnostics (no native imports)
  utils/                     # RNG, time formatting, IDs
```

See [`docs/field-ui-module-map.md`](./docs/field-ui-module-map.md) for the camera-mode UI
module map (what each new module owns and why the boundaries fall where they do).

### How a drill works

1. **Setup** (`(tabs)/index.tsx`) edits the persisted `DrillConfig`.
2. **Start** navigates to `drill/active`, which calls `useDrillEngine()`.
3. The engine **snapshots** the config (`runConfig`), warms TTS, configures the
   audio session, runs a spoken countdown, then drives a single **250 ms tick
   loop** off `Date.now()` minus a paused-accumulator.
4. Each tick, the pure **`CueScheduler`** decides the next cue + interval; the
   engine **interrupts any in-flight speech**, speaks the cue, fires a
   category-specific haptic, and records a **`CueEvent`** (with both wall-clock
   and drill-monotonic timestamps).
5. On finish, it builds a `DrillSession` (config snapshot + full cue timeline)
   and persists it atomically to SQLite. The **summary** screen reads it back.

---

## Key design decisions

- **Pure scheduler, testable core.** `CueScheduler` is pure functions over a
  seedable RNG, so cue sequences are reproducible and unit-testable with no
  device. The `useDrillEngine` hook owns all the side effects (timers, audio,
  haptics, persistence).
- **Cues interrupt, not queue.** `expo-speech` queues by default; we
  `Speech.stop()` before each cue and floor the next interval at the estimated
  utterance length so cues never stack up or drift late.
- **Two clocks on every cue.** Each `CueEvent` stores a wall-clock epoch _and_ a
  drill-monotonic offset. The monotonic axis is exactly what the camera scan
  detection measures reaction time against — no schema rewrite later.
- **Forward-compatible data model.** A `cue_events` table, a nullable
  `verification` column, string IDs, and unused sync columns
  (`synced_at`/`server_id`/`dirty`/`deleted_at`) all ship now, so camera
  verification and a future coach/team sync are **additive**, not rewrites.
- **Camera is a lazy seam.** `src/services/vision` exposes only types, a pure
  scan-detection algorithm, a `PoseVerifier` interface, and a `NullPoseVerifier`.
  Nothing imports `react-native-vision-camera`, so the audio-only build stays Expo-Go-safe.

---

## Known limitations (audio-only build)

- TTS voice quality/voice selection varies by device; in-app volume is
  best-effort on iOS (use device volume).
- Audio is **foreground-only** — keep the screen awake (default on); cues won’t
  play with the app backgrounded.
- Camera verification, coach/team accounts, and cloud sync are **not** in the
  audio-only build. See [ROADMAP.md](./ROADMAP.md).

---

## License

Private / unpublished.
