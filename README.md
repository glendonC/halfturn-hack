# HalfTurn

**Solo scanning and awareness trainer for athletes.**

[Getting started](docs/getting-started.md) · [Architecture](docs/architecture.md) · [Turn & React](docs/turn-and-react-spec.md) · [Roadmap](ROADMAP.md) · [License](LICENSE)

---

## What it is

HalfTurn is a virtual coach in your headphones. It fires randomized spatial cues (`Check left`, `Scan`, `Turn`, sport calls like `Man on`) so players can practice shoulder-checking, scanning, and reacting without a coach or teammate.

Built for field and court sports. Soccer is a primary use case, not the whole category.

The loop we close is: **cue → athlete reorients → (optionally) verified reaction**. We measure body/torso reorientation timing, not whether eyes swept the field. See [metrics notes in architecture](docs/architecture.md#what-we-measure).

## Problem

Scanning and shoulder-checking are coached constantly and practiced rarely. Alone, there is no cue, no timing pressure, and no proof that a check happened before the play.

Most awareness apps are timers or video libraries. They do not close the loop.

## Features

| Mode | What you get |
| ---- | ------------ |
| **Audio drill** | Eyes-free TTS cues, configurable intervals, local history, field-ready HUD. Runs in Expo Go. |
| **Turn & React** | Phone mounted facing you, screen as cue surface, on-device pose verifies the reorientation. Needs a custom dev build. |

Also included: drill setup (duration, cue mix, left/right balance), pre-drill audio check, haptics, SQLite history, and profile settings for voice and field display.

## Quick start

Requires Node 18+ and [Expo Go](https://expo.dev/go) (SDK 54) for the audio path.

```bash
npm install
npm start
```

Scan the QR code with Expo Go. For Turn & React on a physical device, see [Getting started](docs/getting-started.md).

## Docs

| Doc | Purpose |
| --- | ------- |
| [Getting started](docs/getting-started.md) | Install, Expo Go vs dev build, field checklist |
| [Architecture](docs/architecture.md) | Stack, folder map, design seams, what we measure |
| [Turn & React spec](docs/turn-and-react-spec.md) | Camera mode product and build spec |
| [Perception](docs/perception-architecture.md) | Pose stack and swappable backends |
| [Scan tracking](docs/scan-tracking-architecture.md) | Scan detection and validation architecture |
| [Field validation](docs/field-validation-protocol.md) | How we score detector changes outdoors |
| [Field UI map](docs/field-ui-module-map.md) | Camera-mode UI module boundaries |
| [Roadmap](ROADMAP.md) | Phase plan and open seams |

## License

[MIT](LICENSE)
