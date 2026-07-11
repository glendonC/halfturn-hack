# Roadmap

Phased delivery with **seams first**. Every phase must leave the long-term intelligence path open — interfaces, nullable verification fields, and Expo-Go-safe guards — even when the feature itself ships later.

---

## Phase 1 — Audio MVP (this weekend)

**Goal:** Field-testable solo cue drill. No camera required.

### Shipped (hack)

- Cue catalog with fixed cues + color/number variables; resolved `phrase` on each `CueEvent`
- Pure scheduler with speech-duration floor (`estimateSpeechMs`) and optional `avoidLastN`
- TTS via `TtsCueEngine`; turn-react preview uses on-screen cues + Expo-Go-safe onset beep
- Setup + Settings: duration, interval, balance, countdown, voice rate/pitch, cue mix
- Dual clocks + `plannedOffsetMs`; SQLite history with phrase timeline
- `NullPoseVerifier` only — verification stays null/unknown on audio and turn-react preview

### Explicitly out of scope (still)

- Camera, pose, verification UI (Phase 2 / issue #9)
- Cloud accounts / sync
- Shipping large recorded voice packs (ClipCueEngine seam only)

### Seams to freeze now

| Seam | Why |
| ---- | --- |
| `DrillEngine` / scheduler (pure TS) | Cue scheduling independent of React / TTS |
| `AudioCueEngine` interface | Swap TTS → recorded packs later |
| `DrillSession` / `CueEvent` types | Verification fields **nullable** from day one |
| Dual clocks (`wallMs` + `drillMs`) | Reaction timing later without rewriting history |
| `PoseVerifier` + `NullPoseVerifier` stubs | Phase 2 plugs in without touching drill core |

---

## Phase 2 — Turn & React verification

**Goal:** Phone mounted facing the player; screen as cue surface; on-device pose verifies torso/shoulder reorientation after (or before) cues.

**Hack status:** visual cue shell + beep already land in Expo Go; pure scanDetect / filters / YawFusion / PerceptionBackend registry ship as library code. **Pose stays deferred** behind `NullPoseVerifier` + `canUseNativeVision()` until RealPoseVerifier (#27). `expo-dev-client` + EAS `development` profile are the explicit unlock gate (#25) — do not import VisionCamera / MediaPipe on the Train path.

### Ship

- Mount / setup guidance (distance, framing, neutral stance = back-to-camera)
- Visual cue surface on device (mirrors or replaces audio for this mode) — **preview exists; verification does not**
- `PerceptionBackend` adapter: first concrete stack = MediaPipe Pose (lite) on VisionCamera
- Pure scan-detection over a yaw (and later multi-signal) sample stream
- Onset-based reaction windows; anticipation penalty; occlusion policy (drop / mark unknown)
- Session timeline with optional `verification` on each `CueEvent`
- Expo-Go guard: vision modules never imported on the audio-only path; `NullPoseVerifier` always available

### Explicitly out of scope

- Gaze / eye tracking claims
- Cloud upload of frames or landmarks
- Coach dashboard

### Seams to leave open

| Seam | Why |
| ---- | --- |
| `PerceptionBackend` | MediaPipe today → MoveNet / ExecuTorch / Nitro later |
| `PoseVerifier` | UI and drill logic depend only on this |
| `YawSample` stream + pure detectors | Intelligence evolves in TS, not native |
| Occlusion / confidence policy | Honest “unknown” beats fake scores |
| Baseline drift correction | Per-session neutral yaw calibration |

---

## Phase 3 — Smarter training

**Goal:** Training that adapts to verified behavior, not just a louder metronome.

### Ship

- Voice packs (recorded) behind `AudioCuePlayer`
- Adaptive difficulty: interval, cue mix, and reaction windows from recent verified sessions
- Drill programs / progressions (e.g. scan-before-turn emphasis)
- Goals and streaks grounded in **evidence-weighted** metrics (see METRICS.md)
- Richer local analytics: scanned-before-action rate, blind-side balance, anticipation rate

### Seams to leave open

| Seam | Why |
| ---- | --- |
| `DrillProgram` / difficulty policy | Swap heuristics → learned policies later |
| Metric definitions versioned | Don’t break history when formulas change |
| Multi-signal fusion inputs | Yaw + later hip/shoulder asymmetry, etc. |

---

## Phase 4 — Optional cloud sync / coach dashboard

**Goal:** Schema-ready insight for coaches/teams — **not** required for a useful product.

### Ship (only if needed)

- Account + sync of **derived** session summaries and metric aggregates
- Coach/team read views over verified timelines
- Export / share session reports

### Hard constraints

- Raw frames and landmarks **never** sync
- Opt-in only; local-first remains the default
- Schema versioning from Phase 1 types so we don’t retrofit IDs later

### Seams to leave open

| Seam | Why |
| ---- | --- |
| `SessionRepository` (local → syncing) | UI talks to repository, not storage engine |
| Nullable remote IDs on sessions | Offline-created rows remain valid |
| Metric payload version field | Coaches can interpret old sessions |

---

## Non-goals (near-term)

- Multiplayer / live opponent simulation
- Claiming continuous gaze or “peripheral vision training”
- Shipping vision code that breaks Expo Go for Phase 1 testers
- Baking a single pose SDK into screens or drill reducers
