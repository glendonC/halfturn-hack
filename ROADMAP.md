# HalfTurn Roadmap

Phase 1 is a local-first audio coach you can field-test today. Later phases stay additive on seams that already ship.

> **Status:** Phase 2 (Turn & React) has landed and is field-testable in a dev build. See [Getting started](docs/getting-started.md) and [Turn & React spec](docs/turn-and-react-spec.md).

---

## Phase 1: MVP (shipped)

Audio cue engine, drill setup, eyes-free HUD, local history, settings. Runs in Expo Go.

**Seams already shipped for later phases**

- `CueEvent` timeline with dual clocks (wall-clock + drill-monotonic)
- `cue_events` SQLite table
- `DrillSession.verification` nullable column
- `src/services/vision`: `PoseVerifier`, null verifier, pure `detectScans()` / scan verification
- `AudioCueEngine` interface with `ClipCueEngine` placeholder for voice packs
- Unused sync columns (`synced_at` / `server_id` / `dirty` / `deleted_at`) + string IDs

---

## Phase 2: Camera verification (landed)

**Specs**

- [Turn & React spec](docs/turn-and-react-spec.md)
- [Perception architecture](docs/perception-architecture.md)
- [Scan tracking](docs/scan-tracking-architecture.md)
- [Field validation protocol](docs/field-validation-protocol.md)

**Goal:** verify the player actually scanned: count scans, measure reaction time, and check whether they scanned before receiving/turning.

### Metrics (pure reducers in `src/services/vision`)

- Scans / minute and left vs right balance
- Reaction time = `scan.tMonoMs - cue.firedAtMonoMs`
- Scanned-before-action rate for action cues (`turn`, `man_on`, `open_body`)

### Detecting a scan

A scan = head/shoulder yaw crosses an enter threshold, holds past a debounce, then returns under an exit threshold (hysteresis), with a refractory gap. Algorithm is pure over a yaw sample stream.

### Stack

Real-time pose via VisionCamera frame processors + MediaPipe Pose Landmarker. Needs a custom dev client; cannot run in Expo Go. Camera code stays behind the lazy verifier factory so the audio bundle never imports it.

### Realistic caveats

On-device pose is ~15-30 fps and thermally heavy outdoors; derived yaw is noisy at distance / low light; thresholds need field tuning. See the validation protocol for how we score changes.

---

## Phase 3: Smarter training

- Voice packs (`ClipCueEngine`) via `expo-audio`
- Drill programs: structured sessions, progressions, warmups
- Adaptive difficulty from verification metrics
- Streaks and goals

---

## Phase 4: Optional cloud (coach / team)

Only if real users need it. The MVP stays local-first.

- Auth + sync (schema already has string IDs and dirty/synced columns)
- Coach / team dashboard for drills and scan metrics over time
- Keep device-local audio/haptics settings unsynced

---

## Possible later (not committed)

- AI-generated drill plans personalized to scan metrics (optional, never required)
- Apple Watch / wearable haptics as a second eyes-free channel
- Android background-audio mode for pocket training
