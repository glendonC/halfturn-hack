# HalfTurn: Turn-and-React Camera Mode

> ⚠️ **Status:** Turn & React is **built and
> field-testable in a dev build**: mode toggle, framing/calibration, the
> FaceTime cue+squircle layout, on-device MediaPipe pose verification, and
> Summary/History metrics. This file remains the scenario/metrics/data-model
> reference; some sections below read as future tense but the core is built.
> Source-of-truth for what's built: [README](../README.md) →
> [`field-ui-module-map.md`](./field-ui-module-map.md) (UI/module map) →
> [`perception-architecture.md`](./perception-architecture.md).
>
> This document is the build plan for HalfTurn's namesake feature: the **half-turn**.
>
> 🧠 **Perception stack + modular architecture decision:**
> [`perception-architecture.md`](./perception-architecture.md): which CV engine
> (and why), the latency budget, and the swappable `PerceptionBackend` design. Read it alongside §3/§5/§7 here.

---

## 1. The scenario we are building

The player is at a field. The **phone is mounted facing them** (bag, cone, mini-tripod) ~2-4 m
away, screen visible. The player trains with their **back or shoulder to the camera**. On a cue
(a short beep/haptic) they **shoulder-check / half-turn**, and on turning they **see a color,
number, or instruction on the big screen** and react to it. The camera + on-device computer
vision then **verifies the turn**: did they actually look, how fast (reaction time), which way
(left/right shoulder), how many times, and did they turn at the right moment (not guess).

Two things make this design strong:

- **The screen is the cue surface.** It resolves the "the phone that talks to you also has to film
  you" tension: the mounted screen *is* the thing you turn to read.
- **The on-screen value is ground truth.** You can only react correctly if you actually scanned, so
  the drill is self-verifying even before CV confirms the turn.

It also keeps the audio-cue drill's promise: **on-device only, nothing uploads** (these are often youth
players), and the audio-only drill keeps working in Expo Go.

---

## 2. Load-bearing decisions (read these first)

These are the cross-cutting calls the rest of the spec depends on.

1. **Ground-truth input gating.** In turn-and-react mode the screen is the *only* information
   channel: fire a **directionless beep + haptic** on each cue (clean reaction anchor), but
   **suppress TTS of the resolved color/number value** so the player must physically turn to learn
   it. (Today `CueDisplay` reads `currentCue.phrase` and the engine speaks it: this must be gated
   by mode.)

2. **One detector, staged enrichment.** Reuse the **shipped, pure `detectScans()`** path unchanged
   for the initial camera build. The native verifier derives `yawDeg` from the **shoulder-line vector minus a per-player
   neutral baseline** (so "back to camera" reads ~0°, a turn toward the screen reads as signed yaw),
   and sets `confidence = min(shoulder landmark **visibility**)`: never landmark *presence*
   (MediaPipe hallucinates occluded points; visibility is the real discriminator). The richer
   absolute-facing signals are **additive, optional** fields landing later: never a rewrite.

3. **Two reaction clocks, named explicitly.**
   - **Reaction time** (headline, anti-cheat) = `turnStartMonoMs − cue.firedAtMonoMs` (how fast they
     *began* turning).
   - **Time-to-legible** (secondary, a later enrichment) = `peak/face-edge − firedAtMonoMs` (how long until the
     screen was actually readable).
   The initial camera build ships **peak-based** reaction (no change to the pure detector) and footnotes it; a later enrichment emits a
   `startMonoMs` (the detector already tracks `enteredAt` internally) and flips the headline to
   start-based: which is also the gate for **anticipation** detection.

4. **Clock normalization contract.** Anchor a one-time frame-clock→drill-clock offset at
   `verifier.start()` using the **native capture timestamp**, then push it through the *same*
   `− t0 − pausedAccum` transform the engine uses for cues, so `scan.tMonoMs` and
   `cue.firedAtMonoMs` share one axis and reaction time is a pure subtraction. **Never** timestamp
   with `Date.now()` in the frame callback (dispatch jitter under thermal load would corrupt
   reaction time). Stop emitting samples on pause; re-anchor on resume.

5. **Sign convention fixed once, at the verifier boundary.** The phone faces the player, so the
   player's **left** shoulder is on the camera's **right**. Define `yawDeg < 0 ⇒ player's left`
   (matching `cues.ts` where `check_left.side = 'left'`), apply the horizontal flip in the native
   verifier where frames become `PoseSample`s, document it on `PoseSample.yawDeg`, and lock it with a
   unit test (known cued-left trace ⇒ `direction === 'left'`). Everything downstream (direction
   accuracy, L/R balance) inherits it.

6. **Strict import isolation for Expo Go.** All `react-native-vision-camera` / MediaPipe imports live
   **only** in `VisionPoseVerifier.ts` + `CameraVerifierView.tsx`, reached **only** via a dynamic
   `import()` behind a `VISION_ENABLED` flag (`!isExpoGo && EXPO_PUBLIC_VISION`), resolved by a new
   `getPoseVerifierAsync()` (the sync `getPoseVerifier()` keeps returning `NullPoseVerifier`). Add a
   CI grep that **fails if the Expo-Go-reachable graph references vision-camera**. The audio-only
   drill must keep running in Expo Go untouched.

7. **Additive, nullable-everywhere data.** Extend `ScanVerification` and `ScanEvent` *in place* with
   optional fields + an in-blob `metricsVersion`. Do **not** bump `DRILL_SESSION_SCHEMA_VERSION` (it
   is a per-row stamp, not the migration driver). Any real new table (`scan_events`) goes through a
   **new appended `PRAGMA user_version` migration** and is deferred to later. **Persist derived events
   only: never raw `PoseSample` streams** (biometric/privacy + DB bloat; `detectScans` is pure so
   there is nothing to reprocess).

8. **Build on the working stack first.** The initial camera build ships on **VisionCamera v4-snapshot + the maintained
   `react-native-mediapipe-posedetection` plugin** (33 landmarks + world coords + visibility, on
   `react-native-worklets-core`) on a **dedicated EAS dev profile**: zero native code we own, and it
   sidesteps the open VisionCamera-v5/Nitro + Xcode-26 build blocker on SDK 54. The durable
   **VisionCamera v5 + Nitro** pose plugin is a later port, started in parallel, gated on the upstream
   fix. **A custom dev client is mandatory; Expo Go runs the audio-only drill with `verification: null`.**

---

## 3. Detection design (computer vision)

### 3.1 Model choice

- **MediaPipe Pose Landmarker (lite), `LIVE_STREAM` mode: primary and load-bearing.** 33 landmarks
  in image + **world** coordinates (meters, hip-origin), each with `visibility` and `presence`.
  Tracks the body through the full **back → front → back** arc, which is exactly the motion we score.
  `lite` sustains the 15-30 fps outdoor target on the GPU delegate.
- **Face Landmarker: optional, later confirmation only.** Returns *nothing* when the player is turned
  away (the default state here), so it can't be primary. Later it sharpens the front-peak anchor and
  adds true **gaze/iris** ("torso turned but eyes never came to the screen" = a guessing tell).

### 3.2 Deriving the signal the detector needs

Per frame, the native verifier computes and emits a `PoseSample`:

- **Minimal:** `yawDeg` from the shoulder-line vector's depth component
  (`s = worldR_shoulder − worldL_shoulder`; chest square ⇒ `s.z ≈ 0`; turning grows `|s.z|`), minus
  the per-player **neutral baseline** captured at framing, then sign-flipped to the player frame.
  `confidence = min(visibility[left_shoulder], visibility[right_shoulder])`.
- **Later enrichment (all optional):** `torsoYawDeg` (absolute, 0° = chest square), `facingScreen`
  (hysteretic fusion of face-landmark visibility + squareness + both-ears-visible), `faceVis`,
  `startMonoMs`/`endMonoMs`, `matchedCueSeq`.

The fusion that drives `facingScreen` (later enrichment):

```
faceScore = clamp01( 0.60*faceVis
                   + 0.25*(1 − |torsoYawDeg|/90)
                   + 0.15*min(earVisL, earVisR) )
enter facingScreen when faceScore ≥ 0.62 held ≥ FACE_HOLD_MS
exit             when faceScore ≤ 0.45   (hysteresis: same pattern as detectScans)
```

### 3.3 Turn direction, reaction anchor, anti-cheat

- **Direction:** sign of frame-to-frame rotation / the player-frame `yawDeg` sign at the turn.
- **Reaction anchor:** the initial camera build uses the existing yaw **peak** (`scan.tMonoMs`); a later enrichment emits the **start**
  crossing for the headline metric.
- **Anticipation (later):** a turn whose **start precedes** its matched cue is a guess: tag it
  `anticipated`, exclude it from the reaction-time distribution, and don't credit it. Also reject
  sub-human reactions (`< ~200 ms`).

### 3.4 Robustness (real-field correctness)

- **Use `visibility`, not landmark presence**: kills the #1 false positive (occlusion hallucination).
- **Single-subject lock** in the native verifier *before* emitting samples: `numPoses: 1`, lock the
  largest / most-central pose, maintain hip-origin continuity (coaches/teammates in frame otherwise
  corrupt everything). This must live in the verifier: the pure detector never sees it.
- **Reject ball-watching head bobs** via the hold debounce + (later) requiring torso/hip rotation, not
  just head.
- **Store provenance** (`meanPoseConfidence`, `effectiveFps`, `trackedTimeRate`) so History can
  **gray out low-trust runs** instead of presenting noise as truth; null metrics below minimum
  sample counts.

---

## 4. Drill & UX design

### 4.1 The drill loop

1. Player stands with **back/shoulder to the mounted phone**.
2. After a randomized interval, a **beep + haptic** fires (no spoken value).
3. Player **half-turns** to the screen, which is **flooded with a color** and shows a **big
   word/number/instruction**.
4. Player **reacts** (see capture options below).
5. The flood **persists for a reveal window** (~1500 ms) then snaps to neutral; back to step 2.

### 4.2 Cue surface (readable at 2-4 m in sunlight)

- A **new `TurnReactCueDisplay`** (do *not* modify the audio drill's fading `CueDisplay`): the flood is now
  **information**, so it **persists** for `revealWindowMs` instead of fading.
- Giant word/number on an **auto-contrast plate**; **exclude White/Black** from the color palette
  (unreadable as a full-screen flood); add redundant letter/icon coding for colorblind users.
- **Per-screen landscape lock** via `expo-screen-orientation` on mount/unmount (rest of the app stays
  portrait). Request **full screen brightness** for the session (`expo-brightness`), restore on exit.

### 4.3 Framing / setup

A **position-the-phone step** before the drill: full-screen camera with a body outline + "you're in
frame" confirmation, which also captures the **neutral baseline** and **yaw-sign** calibration.
Persist the calibration to a small store so "use last setup" can skip it.

### 4.4 Squircle / smart-mirror

A rounded-square self-view in a corner showing a skeleton overlay whose **color = tracking
confidence** (a health indicator, since the player is mostly turned away). A later enrichment adds a **green pulse on
a verified scan** (UX-only; the post-drill review is authoritative).

### 4.5 Reaction capture (the open fork: see §7)

- **Initial camera build:** **CV-only**: credit the *turn* (count, direction, reaction time). No answer captured.
- **Later:** **tap-the-color** on the squircle when they glance (privacy-safe first choice), then
  optionally **on-device ASR** of the 7-color + 30-number grammar behind a youth/mic disclaimer. This
  is what unlocks `reactionAccuracy` / "looked but reacted wrong": nullable until shipped.

### 4.6 Review & variants

- **Post-drill:** a **scrubbable timeline** of detected turns over cues with reaction times; a
  reaction histogram; a composite **HalfTurn score**; per-side balance.
- **History:** badge + average-reaction sparkline; low-trust runs visibly grayed.
- **Variants:** Reaction-Time, Accuracy, Endurance; difficulty via cadence / reveal-window /
  symbol-complexity presets.
- **Failure UX:** "camera can't see you," lost tracking, too dark → fall back to audio-only,
  `verification` stays null.

---

## 5. Architecture & dev build

### 5.1 Stack (initial camera build)

- `react-native-vision-camera` **v4-snapshot** + `react-native-worklets-core` +
  `react-native-mediapipe-posedetection` (maintained, 33 landmarks + world coords + visibility).
- Frame processor runs Pose inference on a **worklet thread** at ~15 fps, emits `PoseSample`s to JS
  with throttling/skip-frame; never blocks the UI or the 250 ms engine loop.
- Kept on a **dedicated EAS dev profile** pinned to a stable Xcode image: this build does **not** use
  Reanimated-4 worklets in the camera path (avoids the worklets-core ↔ Reanimated-4 collision).
- **Later:** port to **VisionCamera v5 + Nitro** + `react-native-worklets` (single runtime); the Nitro
  plugin we own is "landmarks in → frame out" only: all yaw/fusion math stays in worklet-pure JS.

### 5.2 Module layout (fits the existing `src/services/vision/`)

```
src/services/vision/
  PoseVerifier.ts        # interface + NullPoseVerifier (exists)
  scanDetect.ts          # pure detectScans / computeScanVerification (exists)
  types.ts               # PoseSample / ScanEvent / ScanVerification (exists; extend optionally)
  index.ts               # getPoseVerifier() (sync, Null) + NEW getPoseVerifierAsync()
  VisionPoseVerifier.ts  # NEW: vision-camera + MediaPipe; imported ONLY dynamically
  CameraVerifierView.tsx # NEW: camera preview + frame processor; imported ONLY dynamically
  calibration.ts         # NEW: neutral baseline + yaw sign, persisted
```

### 5.3 Dev-build steps

`expo-dev-client` + the VisionCamera/MediaPipe config plugins + camera permission
(`NSCameraUsageDescription` / `CAMERA`), then `expo run:ios` or an EAS dev profile. **Expo Go is off
the table for this mode**: that's the graduation cost of the camera.

---

## 6. Data model & metrics (additive, local-first)

### 6.1 Extend `ScanVerification` in place

Keep the seven shipped fields; add **optional** ones + a version stamp:

```ts
export interface ScanVerification {
  // --- v1 (shipped, unchanged) ---
  scansDetected: number;
  scansPerMinute: number;
  leftScans: number;
  rightScans: number;
  avgReactionMs: number | null;
  scannedBeforeActionRate: number | null;
  engine: string;

  // --- camera build (all optional / nullable, back-compatible) ---
  metricsVersion?: number;           // in-blob, independent of PRAGMA user_version
  medianReactionMs?: number | null;
  reactionP25Ms?: number | null;
  reactionP75Ms?: number | null;
  reactionP90Ms?: number | null;
  bestReactionMs?: number | null;
  turnDirectionAccuracy?: number | null;   // turned the cued side / direction cues
  anticipationRate?: number | null;        // turns started before the cue
  reactionAccuracy?: number | null;        // answered correctly (null until capture ships)
  lookedButWrongCount?: number | null;
  meanPoseConfidence?: number | null;      // provenance / trust
  effectiveFps?: number | null;
  trackedTimeRate?: number | null;
  halfTurnScore?: number | null;           // composite, formula defined once
}
```

Any old 7-field blob still parses (the unguarded `JSON.parse(... ) as ScanVerification` in
`sessionsRepo.rowToSummary` stays valid). The UI treats a missing optional field as "not measured."

### 6.2 `ScanEvent` enrichment + `scan_events` table (later)

Add optional `startMonoMs` / `endMonoMs` / `confidence` / `matchedCueSeq` to `ScanEvent`. When the
**scrubbable timeline** ships, add a **new appended migration** (`database.ts` `MIGRATIONS[1]`,
`PRAGMA user_version 1 → 2`) creating `scan_events`: mirror the existing `cue_events` DDL: string
`id`, `session_id` FK `ON DELETE CASCADE`, `seq`, `direction`, dual timestamps, `peak_yaw_deg`,
`matched_cue_seq`, `confidence`. Persist **derived events only**.

### 6.3 The reducer (pure, testable like `detectScans`)

`pairCuesToScans(scans, cues, cfg)` greedily matches each scan to exactly one cue (nearest forward
within `scanBeforeWindowMs`, recording `matchedCueSeq`) → per-cue rows `{ matched | missed |
anticipated }`. From those, `computeScanVerification` derives reaction distribution, direction
accuracy, and anticipation rate on the shared `tMonoMs` axis. A scan whose start precedes its matched
cue is `anticipated` and excluded from the reaction distribution.

### 6.4 Forward-compat

The existing `dirty` / `synced_at` / `server_id` / `deleted_at` columns already cover a future
coach/team dashboard + sync: turn metrics ride along as additive columns/blob fields with zero
rework.

---

## 7. How it plugs into the existing engine (concrete seams)

The specs glossed two wiring details: here they are precisely:

- **`verifier.start(t0Ref.current)`** must be called at the **end of `beginRunning()`** in
  `useDrillEngine.ts` (that's the only place `t0Ref.current` is set), not in the async `start()`
  prelude.
- **`finalize()` must become async** (or gain a post-save patch path): `await verifier.stop()` →
  `computeScanVerification(scans, events, actualDurationSec, engineLabel)` → assign to
  `session.verification` (currently hardcoded `null`) before `saveSession`.
- **Mode gating:** in turn-and-react mode, `engine.speak()` of the resolved color/number value is
  suppressed (beep only); `CueDisplay` is swapped for `TurnReactCueDisplay`.
- Everything else: the cue timeline, `firedAtMonoMs`, the `PoseVerifier` factory, the pure
  detector, the nullable `verification` column: already exists and is consumed unchanged.

---

## 8. Build milestones

### Minimal verify-only: the CV-confirmed half-turn

**Scope:** prove a real turn is detected, counted, timed, and directioned end-to-end, filling
`DrillSession.verification` with the **shipped** `computeScanVerification`: zero changes to the pure
detector or DB schema.
Includes: custom EAS dev client on VisionCamera v4 + maintained pose plugin (import-isolated +
CI grep guard); `VisionPoseVerifier` + `CameraVerifierView` (~15 fps, single-subject lock, yaw from
shoulder vector − neutral baseline, confidence = min shoulder visibility); clock-skew anchoring;
sign flip + unit test; engine wiring (`verifier.start` at end of `beginRunning`, async `finalize`);
framing/calibration screen; `TurnReactCueDisplay` with persistent flood + landscape lock + TTS
suppression; squircle tracking-health thumbnail; graceful degrade to `NullPoseVerifier` (Expo Go /
no permission / init fail / too hot).
**Excludes:** `scan_events` table, scrubbable timeline, `pairCuesToScans`, anticipation,
`startMonoMs`, facing fusion, Face Landmarker, composite score, reaction-correctness/ASR, brightness
override (may slip).
**Exit:** outdoors at 2-4 m, back-to-camera: a deliberate L/R half-turn after a beep is detected with
correct direction **≥ 90%** over a 5-min session; `verification` populates and renders on the existing
summary + history screens; reaction time (peak − `firedAtMonoMs`) on the shared axis within tens of ms
of a stopwatch; pausing produces no phantom scans; **Expo Go still runs the audio drill with
`verification` null and zero vision-camera in its bundle** (CI grep passes); player-left sign test
passes; no raw `PoseSample`s persisted.

### Richer review + honest anti-cheat

Emit optional `startMonoMs`/`endMonoMs`/`confidence` on `ScanEvent`, flip the headline reaction to
start-based, add anticipation detection; `pairCuesToScans`; the `scan_events` migration
(`user_version 1 → 2`); extend `ScanVerification` (reaction distribution, accuracy, provenance,
`metricsVersion`); scrubbable timeline + reaction histogram + composite score on Summary; History
badge + sparkline + low-trust graying; capture cue `displayedAtMonoMs` on real paint; Reaction-Time /
Accuracy / Endurance variants; live green-pulse; thermal fallback ladder (15→10→6 fps).
**Exit:** every cue maps to matched/missed/anticipated; a rhythm-guessed turn is tagged `anticipated`
and excluded from `avgReactionMs`; `scan_events` persists and the timeline survives restart via
recompute (new migration runs cleanly on an existing v1 DB; old rows unchanged); low-confidence
sessions visibly grayed; thermal ladder steps fps down under load without crashing; old 7-field blob
still parses.

### Durable stack + facing fusion + correctness axis

Port to VisionCamera v5 + owned Nitro plugin (single worklet runtime, gated on the upstream
Xcode-26/SDK-54 fix); add `facingScreen`/`faceVis`/`torsoYawDeg` fusion + optional Face Landmarker
(default off) for gaze and tighter anti-cheat; reaction-correctness via tap-the-color (then optional
ASR) → populate `reactionAccuracy`/`lookedButWrongCount`; auto-calibration; brightness override.
**Exit:** runs on v5 + Nitro with one worklet runtime and no Reanimated-4 conflict; the facing-fusion
flag measurably cuts false positives on a ball-watching clip; with Face Landmarker on, a
torso-turn-without-gaze is correctly **not** credited; the chosen reaction-capture mechanism hits its
field-accuracy bar and cleanly nulls when off; no metric regresses vs the richer-review milestone; the v4 dev profile can be
retired.

---

## 9. New dependencies (named: the lens specs assumed these)

- `expo-dev-client`: custom dev build (mandatory for camera).
- `react-native-vision-camera` (v4 for the initial camera build → v5/Nitro later) + `react-native-worklets-core`
  (→ `react-native-worklets` later).
- `react-native-mediapipe-posedetection` (initial camera build) → owned Nitro pose plugin (later).
- `expo-screen-orientation`: per-screen landscape lock.
- `expo-brightness`: full-screen brightness for sunlight (with restore-on-exit).
- Thermal-state access (iOS `ProcessInfo.thermalState` / Android equivalent) for the fallback
  ladder: needs a small native module or community package (no Expo module today).

---

## 10. Open questions (need product calls)

1. **Reaction capture** for correctness scoring: tap-the-color, on-device ASR, or a mapped physical
   action? Determines whether `reactionAccuracy` ships in the durable-stack milestone or stays null. (Biggest fork.)
2. **Displayed-value provenance**: give the on-screen value its own column on `scan_events`/cue
   timeline, or reuse `cue_events.spoken_text`? (Fine while screen == audio; a problem once they
   differ.)
3. **`anticipationWindowMs` default** (~800 ms) and whether it's a per-session knob: youth vs
   academy players legitimately pre-scan.
4. **Minimum sample thresholds** before a metric is shown vs nulled (e.g. don't report median
   reaction from < 3 reactions): product sign-off so short drills don't surface misleading
   single-sample percentages.
5. **`displayedAtMonoMs`**: capture a UI paint timestamp for the persistent flood, or accept
   `firedAtMonoMs` and eat the few-ms bias?
