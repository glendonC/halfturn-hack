# HalfTurn

**Solo scanning & awareness trainer for athletes** — a virtual coach in your headphones.

HalfTurn fires randomized spatial cues (“Check left”, “Scan”, “Turn”, and sport-flavored calls like “Man on”) so players can practice checking, scanning, and reacting without a coach or teammate. Built for field and court sports; soccer is a primary use case and example, not the product category.

> **Honesty first:** we verify body/torso reorientation (half-turn / scan timing), not “eyes swept the field.” See [docs/METRICS.md](docs/METRICS.md).

## Problem

Scanning and shoulder-checking are coached constantly and practiced rarely. In a real session you get feedback from a coach or a teammate’s shout. Training alone, there is no cue, no timing pressure, and no way to know whether you actually checked before you played.

Most “awareness” apps are timers or video libraries. They do not close the loop: cue → athlete reorients → verified reaction.

## Solution

1. **Audio drill (Phase 1)** — eyes-free TTS cues with configurable intervals, local history, and a field-testable HUD.
2. **Turn & React (Phase 2)** — phone mounted facing the player; screen as cue surface; on-device pose verifies that the athlete reoriented at the right time — not just that they heard the cue.
3. **Athlete intelligence (Phase 3+)** — adaptive difficulty, drill programs, and evidence-weighted metrics on verified session timelines.

Perception is a **swappable backend**. Drill logic and UI never import MediaPipe (or any other pose stack) directly. See [docs/VISION.md](docs/VISION.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Phased scope

| Phase | Goal | Demo bar |
| ----- | ---- | -------- |
| **1** | Audio MVP | Field-testable cue drill this weekend |
| **2** | Camera-verified Turn & React | Pose behind `PoseVerifier`; Expo-Go-safe null path |
| **3** | Smarter training | Voice packs, adaptive drills, goals |
| **4** | Optional sync | Schema-ready coach/team insight — not required for MVP |

Full detail: [ROADMAP.md](ROADMAP.md).

## Stack intent

| Layer | Choice | Why |
| ----- | ------ | --- |
| App | Expo / React Native | Fast mobile MVP; Expo Go for audio path |
| Audio | `expo-speech` (TTS) first | Zero asset pipeline for weekend demo |
| State | Local-first (AsyncStorage / SQLite later) | Offline by default |
| Vision | MediaPipe Pose (lite) via VisionCamera — **adapter only** | First concrete backend; swappable |
| Intelligence | Pure TypeScript behind frozen seams | Evolve fusion/metrics without native rewrites |
| Privacy | On-device by default | Raw frames/landmarks never leave the device |

Camera / native vision code must be **guarded** so it never poisons the Expo Go audio path.

## Docs map

| Doc | Purpose |
| --- | ------- |
| [ROADMAP.md](ROADMAP.md) | Phase 1–4 delivery + seams to leave open |
| [docs/VISION.md](docs/VISION.md) | Long-term intelligence thesis |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Folder map, frozen interfaces, data model |
| [docs/METRICS.md](docs/METRICS.md) | What we claim (and refuse) to measure |
| [docs/AUDIO.md](docs/AUDIO.md) | TTS engine + iOS silent-switch notes |

## Getting started

Requires Node 20+ and the [Expo Go](https://expo.dev/go) app on your phone (SDK 54).

```bash
npm install
npm start
```

Then scan the QR code with Expo Go (iOS) or the on-screen link (Android). Shortcuts:

```bash
npm run ios       # simulator (macOS)
npm run android   # emulator
npm run typecheck # tsc --noEmit
```

### Expo Go vs custom dev client

| Path | How to run | Vision |
| ---- | ---------- | ------ |
| **Audio + turn-react preview** | `npm start` → Expo Go | Off. `NullPoseVerifier` / `NullBackend` only. |
| **Native pose (Phase 2)** | Custom client via `eas.json` `development` profile (`expo-dev-client`) with `EXPO_PUBLIC_VISION=1` | Gated by `canUseNativeVision()` — never loads on Expo Go. |

`eas.json` already defines a development profile that sets `EXPO_PUBLIC_VISION=1`. VisionCamera / MediaPipe packages are **not** installed yet; the unlock gate and registry are ready for later issues (#26–#27). Do not set `EXPO_PUBLIC_VISION` when developing the audio path in Expo Go.

- **Audio MVP:** Expo Go is fine — no native vision deps required at runtime.
- **Turn & React verification:** requires a custom/dev client. Audio must still run in Expo Go via `NullPoseVerifier`.

## Privacy

- On-device by default.
- Raw camera frames and pose landmarks **never** leave the device.
- If sync ever exists (Phase 4), only **derived metrics** and session summaries — never video or landmark streams.

## License

See [LICENSE](LICENSE).
