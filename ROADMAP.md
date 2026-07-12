# HalfTurn Roadmap

The MVP (Phase 1) is deliberately small: a local-first audio coach that’s
testable on a field today. Everything below is **designed for** but not built,
with the seams already in place so each phase is additive.

> ⚠️ **Update:** Phase 2 (Turn & React camera mode) has since **landed** and is
> field-testable in a dev build — the section below understates current status.
> See [README → Turn & React](./README.md) and
> [`docs/phase-2-field-ui.md`](./docs/phase-2-field-ui.md).

---

## Phase 1 — MVP ✅ (this repo)

Audio cue engine, drill setup, eyes-free active HUD, local history, settings.
Runs in Expo Go. See [README](./README.md).

**Seams already shipped for later phases**

- `CueEvent` timeline persisted per session with **dual clocks** (wall-clock +
  drill-monotonic).
- `cue_events` SQLite table (written now, read in Phase 2).
- `DrillSession.verification` nullable column.
- `src/services/vision`: `PoseVerifier` interface + `NullPoseVerifier` + a pure
  `detectScans()` / `computeScanVerification()` algorithm.
- `AudioCueEngine` interface with a `ClipCueEngine` placeholder for voice packs.
- Unused sync columns (`synced_at`, `server_id`, `dirty`, `deleted_at`) + string
  IDs for a future cloud sync.

---

## Phase 2 — Camera verification (the headline feature)

> 📐 **Detailed build spec:** [`docs/phase-2-camera-spec.md`](./docs/phase-2-camera-spec.md) —
> the "turn‑and‑react" mode (phone mounted facing you, screen as the cue surface), staged
> into 2.0 / 2.x‑a / 2.x‑b with exit criteria.
> 🧠 **Perception stack + modular architecture:** [`docs/phase-2-perception-architecture.md`](./docs/phase-2-perception-architecture.md) —
> the latency-weighted CV-engine decision and the swappable `PerceptionBackend` design for long-term intelligence.

**Goal:** verify the player _actually_ scanned — count scans, measure reaction
time, and check whether they scanned **before** receiving/turning.

### Metrics (already defined as pure reducers in `src/services/vision`)

- **Scans / minute** and **left vs right scan balance**
- **Reaction time** = `scan.tMonoMs − cue.firedAtMonoMs` (pure subtraction,
  thanks to the shared drill-clock axis recorded in the MVP)
- **Scanned-before-action rate** — for each action cue (`turn`, `man_on`,
  `open_body`), was there a scan in the lookback window beforehand?

### Detecting a “scan” (designed in `scanDetect.ts`)

A scan = head/shoulder **yaw** crosses an enter threshold, holds past a debounce,
then returns under an exit threshold (hysteresis), with a refractory gap between
scans. Yaw is derived from pose landmarks (nose vs shoulder-midpoint, preferably
world landmarks for scale-invariance). The algorithm is a **pure function over a
yaw sample stream**, unit-testable today against synthetic traces.

### Stack — decide at Phase-2 start, not pinned now

Real-time pose on RN New Arch via **VisionCamera frame processors + MediaPipe
Pose Landmarker** (deriving yaw). Two concrete paths; pick when starting:

- **Path A (lowest risk):** VisionCamera **v4** + `react-native-worklets-core` +
  `react-native-mediapipe-posedetection` (ships an Expo config plugin).
- **Path B (forward-looking):** VisionCamera **v5** (Nitro) +
  `react-native-worklets` + a v5-compatible pose frame-processor plugin.

> ⚠️ VisionCamera (any version) needs a **custom dev client / EAS build** and
> cannot run in Expo Go. Phase 2 graduates the dev loop from “Expo Go on a field”
> to a dev build — a known, accepted step. All camera code stays behind the lazy
> `getPoseVerifier()` factory so the MVP bundle never imports it.

### Realistic caveats

On-device pose is ~15–30 fps and battery/thermally heavy outdoors; derived yaw is
noisy at distance / low light (needs confidence gating); thresholds will need
tuning against real field footage.

---

## Phase 3 — Smarter training

- **Voice packs** (`ClipCueEngine`): recorded coach voices via `expo-audio`
  (also more reliable in iOS silent mode than TTS).
- **Drill programs**: structured sessions, progressions, warmups.
- **Adaptive difficulty**: shorten intervals / add cue types as performance
  improves (using the verification metrics).
- **Streaks & goals**: weekly scan targets, reminders.

---

## Phase 4 — Optional cloud (coach / team)

Only if real users need it — the MVP stays local-first.

- **Auth + sync** via Supabase or Convex. The schema already has string IDs and
  `dirty`/`synced_at`/`server_id`/`deleted_at` for last-write-wins reconciliation.
- **Coach / team dashboard**: assign drills, compare players’ scan metrics over
  time, leaderboards.
- Keep device-local settings (audio/haptics) unsynced; sync only progress + drill
  programs.

---

## Possible later (not committed)

- AI-generated drill plans (server-side LLM) personalized to a player’s scan
  metrics — strictly optional, never required for core training.
- Apple Watch / wearable haptics as a second eyes-free cue channel.
- Android background-audio mode for pocket training.
