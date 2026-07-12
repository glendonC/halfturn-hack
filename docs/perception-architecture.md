# HalfTurn — Perception Stack Decision & Modular Architecture

> Companion to [`turn-and-react-spec.md`](./turn-and-react-spec.md). This doc answers
> **"what's the fastest + smartest on-device CV, and how do we make it swappable for years?"**
> Decision reached via a latency-weighted evaluation of 6 candidate stacks + adversarial
> verification of the latency claims of the fastest 3.
>
> **Status — pure, Expo-Go-safe, tested:** the `PerceptionBackend` boundary,
> `YawFusion`, `calibration` store, `NullBackend` + registry, the wired `RealPoseVerifier`,
> the additive type/detector extensions, `getPoseVerifierAsync` + `VISION_ENABLED`, the
> CI guard (`npm run guard:expo-go`), and unit tests (`npm test`).
>
> **Status — native + wiring (dev-build):** `backends/MediaPipeBackend` (a sink BRIDGE —
> the pose lib is hook-based, so `CameraVerifierView` runs `usePoseDetection` and forwards
> frames via `feedRawFrame`; `MediaPipeBackend` imports the pose package as a TYPE only, so it
> has no native runtime dep), `CameraVerifierView`, `LazyCameraVerifier` (dynamic-imported,
> `VISION_ENABLED`-gated), the framing/calibration screen (`app/drill/framing.tsx`), the
> `TurnReactCueDisplay` cue surface, `DrillConfig.mode`, Summary/History verification rendering,
> and the engine wiring (`verifier.start(0)` at the end of `beginRunning`; **async** `finalize`
> → `computeScanVerification`; additive `pause()`/`resume()` re-anchor; TTS gating + beep).
> Pinned deps: `react-native-vision-camera@4.7.3` (MUST pin — npm `latest` is v5/Nitro),
> `react-native-worklets-core@1.6.3`, `react-native-mediapipe-posedetection@0.4.0`,
> `expo-dev-client@~6.0.21`, `expo-screen-orientation@~9.0.9`, `expo-brightness@~14.0.8`,
> `expo-build-properties` (iOS `useFrameworks: "static"` — required by the pose pod).
>
> ⚠️ **Gotchas discovered building the camera mode:**
> 1. **Babel shims.** `react-native-worklets-core@1.6.3`'s babel plugin references deprecated
>    plugin names; on SDK 54's Babel the bundle fails to build until these are installed as
>    devDeps: `@babel/plugin-proposal-optional-chaining`,
>    `@babel/plugin-proposal-nullish-coalescing-operator`,
>    `@babel/plugin-transform-template-literals`, `@babel/plugin-transform-shorthand-properties`,
>    `@babel/plugin-transform-arrow-functions`.
> 2. **No frame timestamp.** The pose lib's JS result exposes only `inferenceTime` (no capture
>    timestamp), so `captureClockMs = Date.now() − inferenceTime` (epoch axis, same as the engine
>    t0). This is the doc's "calibrate a fixed pipeline-delay offset" fallback, not the ideal
>    native capture clock.
> 3. **~15fps is hard-capped in the plugin's native code** (`minFrameInterval = 0.066`); `fpsMode`
>    can only go lower. So the two "mandatory latency fixes" (§2) are NOT met by the stock package —
>    decision: ship the camera mode on stock, measure on-device, and only fork/patch native (raise
>    the cap + forward `frame.timestamp`) if the exit bar's reaction-time check misses.
>
> **Remaining (the human/device step):** `eas build --profile development --platform ios` on an
> iPhone (camera needs a physical device), then validate the §8 exit bar; patch native per
> gotcha #3 only if needed.

---

## 1. Decision

**Primary stack:** **MediaPipe Pose Landmarker (lite, GPU)** on **VisionCamera v4** +
`react-native-worklets-core` + `react-native-mediapipe-posedetection`.

**Fallback (one backend-swap away):** **MoveNet Lightning** via `react-native-fast-tflite` (v4),
inference run **in-worklet**.

**Explicitly deferred to later** (great future, wrong milestone): VisionCamera v5 + Nitro owned plugin,
ExecuTorch, and platform-native (Apple Vision + ML Kit).

### Why — the latency reframe that drove it

The naive question is "which model has the lowest inference ms." That's the **wrong** question here, for three reasons the adversarial pass proved:

1. **Inference isn't the bottleneck.** On every candidate the glass-to-decision time is dominated by
   the **~40–57 ms camera/ISP floor + frame-delivery**, which is roughly identical across stacks.
   MediaPipe lite inference is ~8–12 ms on GPU — noise next to the camera floor.
2. **The recorded reaction-time metric is already peak-anchored.** The shipped `detectScans`
   (`scanDetect.ts`) stamps the scan at the **yaw peak**, so the 150 ms hold-debounce and the
   head-return swing **never enter the recorded number**. The only systematic error is a *constant,
   calibratable bias* between glass and the peak frame.
3. **"Fastest on paper" candidates don't build or detect the right thing here.** Every v5/Nitro
   option (Nitro plugin, BlazeFace-tiered, ExecuTorch) hits an **unresolved Xcode-26 build blocker on
   SDK 54** — a stack that doesn't build has *infinite* latency. The platform-native and face-edge
   options **return nothing when the player's back is turned** — which is the drill's neutral state.

So the real question is: *which **buildable** stack gives the lowest, most stable bias on the
peak-anchored metric while actually detecting a back-to-camera half-turn and its direction?* MediaPipe
on v4 wins:

- **Only candidate confirmed to build on SDK 54 today** (RN 0.81, New Arch, dev build).
- **Richest signal for the back-to-camera case** — 33 landmarks *with world coordinates* and the
  **visibility-vs-presence** distinction that lets us reject MediaPipe's occlusion hallucination
  (strictly better than MoveNet's 17 2D keypoints, or a face detector that goes silent when you turn
  away).
- Its two genuine latency liabilities are **both fixable and mandatory** (below).
- It's the stack the spec already commits to — no re-architecture.

### Latency-weighted scorecard (latency 50% · capability 20% · SDK-54 compat 20% · future 10%)

| Stack | Latency | Capability | Compat | Future | **Total** |
|---|---:|---:|---:|---:|---:|
| **MediaPipe lite / VC v4** ✅ | 7.5 | 9.0 | 9.5 | 6.5 | **8.05** |
| MoveNet Lightning / tflite v4 (fallback) | 8.0 | 6.5 | 7.0 | 7.5 | **7.35** |
| v5 Nitro + owned plugin | 6.5 | 7.5 | 2.0 | 9.5 | 6.05 |
| ExecuTorch / PyTorch Edge | 6.5 | 7.0 | 2.0 | 10 | 6.05 |
| Apple Vision + ML Kit (native) | 7.0 | 4.0 | 4.0 | 4.5 | 5.45 |
| BlazeFace edge-trigger (tiered, v5) | 4.0 | 3.5 | 2.5 | 7.0 | 4.05 |

> MoveNet scores *higher on raw latency* (in-worklet, no forced JS hop, no library FPS throttle) but
> loses on the back-facing signal quality and on compat-today. It's the decisive fallback, kept one
> adapter away.

---

## 2. The two mandatory latency fixes

These are non-negotiable; without them the metric is silently corrupted.

1. **Raise `fpsMode` to 25–30.** The library self-throttles to **~15 fps (66 ms grid)** by default —
   the single largest latency + jitter contributor. Raising it is the biggest single win. Pair with
   lite + GPU + `numPoses: 1` + masks off so inference fits the tighter grid.
2. **Anchor the NATIVE capture timestamp, never `Date.now()` at the callback.** The plugin exposes
   `inferenceTime` but **no capture timestamp**; stamping `tMonoMs` when `onResults` fires injects
   **~100–180 ms** of jitter-laden pipeline lag straight into reaction time. Fix: patch the native
   module to attach `frame.presentationTimestamp` (minus `inferenceTime`), **or** calibrate a fixed
   pipeline-delay offset against `CueEvent.firedAtMonoMs`. Anchor **one** frame-clock→drill-clock
   offset at `start()` and push every sample through the same `− t0 − pausedAccum` transform the
   engine uses for cues.

---

## 3. Latency budget (the honest numbers)

Two clocks, named explicitly (per the spec's two-clock contract):

### A. Recorded reaction time — what History/Summary show (peak-anchored)

| Stage | Typical ms | How to minimize |
|---|---:|---|
| Sensor exposure + readout | 16–33 | Cap 30 fps; short outdoor exposure → low end |
| ISP + frame → VC buffer | 15–24 | YUV (no RGB convert on hot path); modest resolution |
| Frame → model (throttle grid) | **dominant** | **Raise `fpsMode` 15 → 25–30** (66 ms → 33–40 ms grid) |
| MediaPipe lite inference | 8–12 | lite not full; GPU; masks off; `numPoses: 1` |
| Native → JS hop | 2–8 | Keep `onResults` trivial (compute yaw, push sample) |
| Yaw math + `detectScans` | <1 | Pure function |
| **Recorded bias (constant)** | **~30–55** | → **~0** with native capture-timestamp anchoring |

This is a **bias, not skew** — stable and calibratable — *only if* you anchor the native capture
timestamp. The debounce and return swing don't enter it because the metric is peak-anchored.
**Result: an honest reaction-time metric, ships in the initial camera build.**

### B. Live glass-to-decision — when code first *emits* "a turn happened" (gates future live cueing)

`detectScans` emits only after yaw **returns** under `yawExitDeg` AND held ≥ `minHoldMs`, so:
`up-swing (~150–300) + hold (150) + down-swing (~100–200) + 1–2 sample periods (33–80)` ≈
**~250–450 ms after turn start**. Reducible to **~150–300 ms** later via an **additive
start-crossing emit** (the detector already tracks `enteredAt` internally) — *without* touching the
recorded-metric path. Not needed for the initial camera build.

---

## 4. The modular, swappable perception architecture

The existing seam (`PoseVerifier` + pure `detectScans` over `PoseSample` + `getPoseVerifier` +
`NullPoseVerifier`) is **already the right insulation**. We don't break it — we add **three stable
interfaces under it** and a **fusion layer between** the backend and the detector. The model ("brain")
becomes swappable; the drill engine and the pure detector never change.

```
 drill engine ──sees only──▶ PoseVerifier            (frozen public contract)
                                  │
                       VisionPoseVerifier            (composition shell, dev-build only)
                                  │
          ┌───────────────────────┼───────────────────────┐
   PerceptionBackend          YawFusion              detectScans (pure, unchanged)
   (swappable model)     (where intelligence grows)   sees only PoseSample
          │
   ┌──────┼─────────┬──────────────┐
 MediaPipe   MoveNet/tflite   ExecuTorch…   NullBackend
 (primary)   (fallback)       (future)      (Expo Go)
```

### The three frozen interfaces

1. **`PoseVerifier`** *(exists, unchanged)* — `start(t0Mono)` / `stop(): Promise<ScanEvent[]>`. The
   drill engine only ever sees this.
2. **`PoseSample`** *(exists; extend additively only)* — `{ tMonoMs, yawDeg, confidence }`. The pure
   detector only ever sees this. New optional fields (`startMonoMs?`, `torsoYawDeg?`, `faceVis?`,
   `facingScreen?`) are additive — never remove or change semantics.
3. **`PerceptionBackend`** *(new — the swappable-model boundary)*:
   ```ts
   interface PerceptionBackend {
     readonly id: string;
     readonly version: string;            // model version → provenance / A-B
     available(): Promise<boolean>;
     start(cfg): void;
     onRawPose(cb: (raw: RawPoseFrame) => void): void;
     stop(): void;
   }
   interface RawPoseFrame {
     captureClockMs: number;              // NATIVE capture clock (not Date.now())
     landmarks: Landmark[];
     world?: Landmark3D[];
     perLandmarkVisibility?: number[];
     modelId: string;
     inferenceMs?: number;
   }
   ```
   A new model = a new `PerceptionBackend` implementation. Nothing above this line changes.

### The fusion layer — where intelligence grows

`YawFusion.ts` (pure) is the **only** place that knows about landmarks/world coords/visibility. It maps
`RawPoseFrame → PoseSample`. Today it does the current derivation (shoulder-world-vector depth − per-player
neutral baseline; sign flip so player-left = `yawDeg < 0`; `confidence = min shoulder visibility`).
Tomorrow it fuses **more signals** (hip rotation, ear/face-visibility swing, gaze, optical-flow,
IMU, a cheap high-rate edge backend for timing + a rich low-rate backend for direction) into the
**same** `yawDeg + confidence` scalar — additively. `detectScans` never changes.

### Threading & mount

- **Camera/worklet thread:** frame delivery; fallback runs inference *in-worklet* (no hop). MediaPipe
  runs async on its native LIVE_STREAM thread; results land on JS (forced hop, accepted — keep
  `onResults` trivial).
- **JS thread:** `YawFusion` (O(1)/frame) + push sample + incremental `detectScans`. Off the 250 ms
  engine-loop critical path.
- **Clock anchor** captured **once** at `start()` from the native capture clock, so JS scheduling
  jitter under thermal load never re-enters the metric.
- **`CameraVerifierView.tsx`** (dynamic-imported) holds the `<Camera>` + frame processor + the squircle
  tracking-health overlay; mounted only by the turn-react screen in the dev build. Everything above it
  is Expo-Go-safe.

---

## 5. Scaling the intelligence over years — without rewrites

Every upgrade is additive at one of the three frozen boundaries:

1. **Add signals via fusion** — start-crossing emit, hip-rotation cross-check (reject head-only
   ball-watching), absolute `torsoYawDeg`. Optional `PoseSample` fields; detector untouched.
2. **Add gaze / multi-signal fusion** — a second low-rate Face-Landmarker backend; fuse
   `faceVis`/iris into a `facingScreen` signal ("torso turned but eyes never came to the screen" =
   guessing tell). Lives entirely in `YawFusion`.
3. **Swap the brain** — MediaPipe lite→full, MoveNet→Thunder, or a soccer-specific back-facing custom
   net, or ExecuTorch `.pte` — each a new backend in the registry. **Model versioning** via
   `backend.id + version` stamped into `ScanVerification.engine` + `metricsVersion`, so old sessions
   stay interpretable and metrics are comparable across versions.
4. **On-device → optional edge** — a tethered/companion heavier model in a lab is a drop-in backend;
   off by default (youth-privacy constraint preserved).
5. **Tiered fast-trigger + slow-intelligence** — cheap high-rate edge backend for *timing* fused with
   a rich low-rate pose backend for *direction* — pushes future live-cueing latency down without
   slowing the recorded metric.
6. **Threshold auto-tuning + telemetry** — provenance fields (`meanPoseConfidence`, `effectiveFps`,
   `trackedTimeRate`) feed per-device tuning of `yawEnterDeg`/`minConfidence` and the thermal ladder;
   gray out low-trust runs.
7. **A/B of detectors/models** — backend selection is a flag + capability probe, every backend stamps
   id/version → ship two and compare direction accuracy / reaction distribution on the shared
   drill-clock axis. Pure data analysis, zero rework.
8. **The v5/Nitro port** — the owned "landmarks-in / frame-out" Nitro plugin is just a new
   backend behind the same seam, gated on the upstream Xcode-26 fix; retiring the v4 profile changes
   nothing above the backend line.

---

## 6. Migration from the current seam (all additive)

| Step | What | Touches |
|---|---|---|
| 0 | Unit test: synthetic cued-LEFT trace → `detectScans` asserts `direction === 'left'` (locks the sign convention before any native code) | new test |
| 1 | Add `PerceptionBackend.ts` + `YawFusion.ts` (pure TS, no deps, Expo-Go-safe); unit-test fusion | new files |
| 2 | Extend `PoseSample` / `ScanEvent` / `ScanVerification` with **optional** fields + `metricsVersion` (no `DRILL_SESSION_SCHEMA_VERSION` bump) | `types.ts` |
| 3 | `calibration.ts` — persist per-player neutral baseline + yaw sign from framing | new file |
| 4 | Dev profile (expo-dev-client + VC v4 + worklets-core + mediapipe plugin + camera perm); `backends/MediaPipeBackend.ts` (single-subject lock, lite+GPU, masks off, **fpsMode 25–30**, **native capture timestamp**); `VisionPoseVerifier.ts`; `CameraVerifierView.tsx` — **all vision-camera imports isolated here, dynamic-imported only** | new files |
| 5 | Generalize the factory: keep sync `getPoseVerifier()` → Null; add async `getPoseVerifierAsync()` behind `VISION_ENABLED`; **CI grep fails if the Expo-Go graph references vision-camera** | `index.ts` |
| 6 | Wire engine: `verifier.start(t0Ref.current)` at end of `beginRunning()`; make `finalize()` async (`await verifier.stop()` → `computeScanVerification` → `session.verification`); gate `engine.speak()` of the value in turn-react mode; swap `CueDisplay` → `TurnReactCueDisplay` | `useDrillEngine.ts` |
| 7 | Apply + validate the two mandatory latency fixes against the exit bar | — |

**Fallback swap:** add `backends/MoveNetTfliteBackend.ts` implementing the same `PerceptionBackend`,
register it in the factory. `YawFusion`, `detectScans`, the engine wiring, and the seam are untouched.

---

## 7. Top risks

| Risk | Mitigation |
|---|---|
| **Capture-timestamp gap** — naive `onResults` stamping injects ~100–180 ms skew | Mandatory: native `presentationTimestamp` or a calibrated offset; anchor once at `start()`. Lock with a stopwatch-vs-recorded test at the exit bar. |
| **15 fps default throttle** corrupts the metric | Raise `fpsMode` to 25–30; lite+GPU+masks-off; thermal ladder 15→10→6 degrades fps not correctness. |
| **BlazePose degrades back-to-camera** at 2–4 m | Yaw from shoulder *world* vector + neutral baseline; gate on **visibility** not presence; validate ≥90% direction outdoors before committing; MoveNet fallback ready. |
| **Single-maintainer wrapper** (v0.4.0) bus-factor | The `PerceptionBackend` boundary isolates it to one file; MoveNet (first-party Margelo) is a drop-in swap; pin known-good versions. |
| **RN 0.83+/SDK 55 worklets-core ↔ Reanimated-4 collision** | Treat v4+worklets-core as a deliberate 12–18 mo bridge (clean on RN 0.81); plan the v5+Nitro port as a new backend gated on the upstream fix. |
| **v5/Nitro candidates don't build on SDK 54 (Xcode-26 #3743)** | Decisive reason primary + fallback both stay on VC v4; keep the v5 port parallel and gated. |
| **Live emit ~250–450 ms** (bad for future live cueing) | Recorded metric unaffected (peak-anchored). For live cueing add an additive start-crossing emit later → ~150–300 ms. |

---

## 8. Pose model selection — the registry and the lite-vs-full benchmark

§1 chose **lite** on reasoning, not measurement (`lite` sustains the outdoor fps target; `full` is
a heavier net against a ~15 fps cap with little headroom). This section makes that a **measured**
decision and keeps the choice swappable.

### 8.1 The registry (`src/services/vision/poseModel.ts`)

The model used to be hardcoded in three places that could not stay in sync — the filename in
`CameraVerifierView`, the `modelId`/`version` in `MediaPipeBackend`, and the URL in
`scripts/fetch-pose-model.sh`. That is a benchmark-killer: **an arm that swaps the model but not
the provenance stamp produces captures you cannot tell apart.** Now one `PoseModelSpec` owns the
filename *and* the stamp:

| variant | file | engine label | size |
|---|---|---|---:|
| `lite` (default) | `pose_landmarker_lite.task` | `mediapipe@pose-lite-0.4.0` | 5.5 MB |
| `full` | `pose_landmarker_full.task` | `mediapipe@pose-full-0.4.0` | 9.0 MB |

`poseModel.ts` is pure data + a resolver; the persisted *selection* lives in `poseModelStore.ts`
(so `MediaPipeBackend` depends on the registry without dragging storage into its tests). The spec
is injected once per run in `getPoseVerifierAsync` → `pickBackend(model)`, so every sample and the
engine label of a run name the same variant.

**The swap is a runtime change, not a rebuild.** The pose library takes the model as a bare
filename and re-creates its detector when that string changes, and the config plugin bundles
*every* `.task` under `assets/models/`. So `npm run fetch-model` pulls both, one build carries
both, and the `__DEV__` `PoseModelPicker` (framing screen) alternates arms in the field.

### 8.2 How the benchmark is scored — label-free

The acceptance protocol in [`field-validation-protocol.md`](./field-validation-protocol.md) needs a
240 fps rig and hand-coded labels. A *model comparison* does not, because **a cued drill is
self-labeling**: a `check_left` / `check_right` cue tells the player which way to turn, so the cue's
own `side` is ground truth for free (`computeCuedDirectionAccuracy` → `ScanVerification.turnDirectionAccuracy`,
declared since the camera build and populated as of this work).

| Axis | Source | Labels needed |
|---|---|---|
| `effectiveFps` · `meanPoseConfidence` · `trackedTimeRate` | `computeTrackingQuality` off the capture | no |
| cued direction accuracy | the cue's own `side` | no |
| cued-turn recall | one directional cue ⇒ one expected turn | no |

⚠️ **What this is not.** Cued accuracy counts a player who turns the *wrong way* as a model miss,
so it conflates player error with model error. That confound is identical across arms and therefore
cancels in an A/B — but it is **not** the §7 absolute ≥95% acceptance bar, which still requires
hand-coded labels. The report prints this caveat under every run; never quote a cued number as an
acceptance number.

### 8.3 Protocol

One dev build (both `.task` files bundled). Per arm: ~5 min Turn & React at ~3 m, back-turned,
**`check_left`/`check_right` cues only**, balanced L/R, `EXPO_PUBLIC_VISION=1 EXPO_PUBLIC_CAPTURE=1`.
**Alternate the arms** (lite → full → lite → full) so thermal drift and fatigue cancel. Then:

```sh
node scripts/collect-capture.mjs metro-log.txt <id>.capture.json
node scripts/analyze-capture.mjs <id>.capture.json      # no labels file needed
```

### 8.4 ⚠️ The decisive metric turned out to be the NOISE FLOOR, not fps

The first field data changed what this benchmark is even about. Measured on `lite` at ~3 m, derived
torso yaw is **8–17° MAD (σ ≈ 8–21°) with the player's back to the camera**, versus **1.0° turned
to the side** — an order of magnitude, same athlete, same distance, same light. See
[`scan-tracking-architecture.md`](./scan-tracking-architecture.md) §10b.

That noise sits at only **~1.3–3.5σ of `yawEnterDeg` (28°)**: a motionless player can trip the
scan-enter threshold on noise alone. So "is `full` worth it?" is no longer mainly a question about
frames per second. It is:

> **Does `full`'s better-constrained world-z collapse the back-turned noise floor?**

If it does, it fixes framing calibration *and* the phantom-scan risk in one move, and 3.5 MB is
cheap. If it does not, the noise is intrinsic to monocular back-on pose, and the fix is filtering
(One-Euro, already built and off) plus per-player thresholds — not a bigger net.

**Measuring it costs ~30 seconds per arm and needs no drill and no labels:** the framing screen
already logs `sigma` and `baseSE` on every capture. Tap the model picker, do one back-turned capture
per arm, compare the two numbers.

### 8.5 Exit bar and result

Adopt `full` as `DEFAULT_POSE_MODEL` if it **materially lowers the back-turned noise floor** (now the
primary axis) without regressing cued direction accuracy or cued-turn recall, **while holding**
`effectiveFps ≥ 12` and `trackedTimeRate ≥ 0.90`. `full` is +3.5 MB, so a tie loses.

| arm | back-turned σ | baseSE | effectiveFps | trackedTimeRate | cued-recall | cued-dir% |
|---|---:|---:|---:|---:|---:|---:|
| `lite` | **8–21°** | 3.2–6.8° | _pending_ | _pending_ | _pending_ | _pending_ |
| `full` | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

**Decision: `lite` remains the default until the `full` row is filled.** The registry makes flipping
it a one-constant change (`DEFAULT_POSE_MODEL`), plus a `metricsVersion` bump if the detection stream
moves.
