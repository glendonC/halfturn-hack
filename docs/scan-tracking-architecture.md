# HalfTurn — Modular, Accurate, Scalable Athlete-Tracking Architecture

> Companion to [`perception-architecture.md`](./perception-architecture.md)
> (the perception seam this work grows inside), [`turn-and-react-spec.md`](./turn-and-react-spec.md)
> (scenario / metrics / data model), and [`field-ui-module-map.md`](./field-ui-module-map.md)
> (UI/module map). This doc answers **"what is the best modular, swappable, accurate,
> scalable full-stack tracking system for verifying a footballer's scan — and how does
> it sit behind the interfaces we already froze?"**
>
> **How it was produced.** A 6-stream research fan-out (biomechanics, on-device models,
> fusion algorithms, sport science, privacy/platform, validation), then **adversarial
> verification of every load-bearing claim** by two diverse skeptics each (an
> evidence-refutation lens + a "does it survive HalfTurn's exact back-to-camera / 2–4 m /
> outdoor / 15 fps / no-timestamp setup" lens). 66 agents, 30 load-bearing claims, 59
> verdicts: **4 confirmed, 55 partially-confirmed, 0 refuted** — i.e. nearly every claim
> survived but with a *material correction*. Those corrections are the spine of this doc;
> where a naive design would have been wrong, the ⚠️ notes say why.
>
> **Nothing here breaks a frozen contract.** `PoseVerifier` / `PoseSample` /
> `PerceptionBackend` / `RawPoseFrame` evolve additively; the pure `YawFusion` +
> `detectScans` seam is where ~90% of this work lives; the clock contract, the Expo-Go
> guard, the on-device/privacy-first default, and the pinned deps are all preserved.

---

## 0. TL;DR

1. **The geometry decides everything.** The athlete's back is to the front camera in
   neutral, so gaze, head yaw, and neck-vs-torso decoupling — the signals that *prove a
   visual scan* — are **blind in neutral** and only **coarsely** recoverable at the
   front-facing turn peak. The always-on, back-to-camera-recoverable signals are
   **torso/shoulder yaw, hip yaw, excursion, and angular velocity**. The tracking system must be
   built on those, and must be **honest** that it verifies *"the body/face rotated far
   enough, fast enough, the right way, at the right time"* — not *"the eyes swept the field."*
2. **The drill design is the escape hatch.** Reading a screen *requires* a large
   face-toward-camera turn, so a valid rep is necessarily a large-amplitude, ballistic
   reorientation that brings the face into the front arc — which converts an unobservable
   "did they scan?" into an observable *"did the face physically rotate far enough to read
   the stimulus?"*
3. **The highest-leverage moves are all PURE-TS behind the frozen seam** (no new backend,
   no native, no pinned-dep change): a z-independent yaw estimator fused with today's
   z-based one, hip-yaw + shoulder-vs-hip decoupling, a One-Euro filter, **reaction from
   movement *onset* not the yaw *peak***, anticipation detection, an occlusion policy, and
   an intra-session baseline-drift tracker.
4. **Metrics must be evidence-weighted and honest.** The scanning-frequency→performance
   effect is *small* (~3–4% of variance); the composite score must lead with
   **scanning-before-the-action** (`scannedBeforeActionRate`) and **blind-side balance**,
   down-weight raw frequency, treat **pre-cue anticipation** (`anticipationRate`, i.e.
   turning *before the cue fires* = guessing) as a **penalty, not a reward**, and **never
   label torso-yaw counts as "scans/second"** against Jordet's head-coded norms. ⚠️ Do not
   conflate the sport-science "scan *before you receive the ball*" (a good habit → maps to
   `scannedBeforeActionRate`) with HalfTurn's `anticipationRate` (gun-jumping the cue → bad).
5. **Privacy is the moat, not a tax.** On-device-only + derived-metrics-only keeps
   HalfTurn out of COPPA "collection," BIPA face-geometry, and GDPR Art-9 — *provided*
   raw frames/landmarks and persistent identifiers never leave the device. Make that
   boundary a **test**, not a convention.
6. **Gaze / continuous head-yaw is a later, backend-gated corroborator** — never the
   primary anti-cheat signal, because it is geometrically blind for the whole diagnostic
   window.

---

## 1. What is measurable vs wishful (Stream A + C + D, verified)

The single most important table in this document. "Recoverable" = from monocular RGB with
MediaPipe Pose **lite**, at 2–4 m outdoors, with the athlete's back to a front camera.

| Signal | Encodes | Neutral (back-to-camera) | Turn peak (face toward screen) | Verdict |
|---|---|---|---|---|
| **Torso/shoulder yaw** | trunk reorientation | ✅ recoverable (world shoulder vector) | ✅ | **Backbone.** Use *relative-to-baseline* + velocity, **not** absolute `atan2` (LITE z is noisy near 0°). |
| **Hip/pelvis yaw** | whole-body pivot | 🟡 recoverable but noisier (central, arm/ball-occluded, low visibility) | 🟡 | Additive. Enables shoulder−hip **decoupling** but is a *difference of two noisy z-signals* — **must be field-validated, not assumed.** |
| **Excursion (∫ yaw)** | how far they turned | ✅ (torso excursion) | ✅ | **Primary discriminator** — an integral, robust to the 15 fps aliasing. |
| **Angular velocity** | ballistic vs drift | 🟡 aliased at 15 fps (a 200–400 ms turn is 3–6 frames) | 🟡 | **Secondary/confirmatory** only. Peak velocity is systematically under-estimated. |
| **Face visibility / `facingScreen`** | "face came around" | ❌ (face self-occluded) | 🟡 coarse, binary-ish | Peak-time **confirmation flag** only. *Empirically unproven that it rises reliably — needs field capture.* Never a continuous head-yaw. |
| **Head/cervical yaw** | the actual scan | ❌ | 🟡 coarse (ear/eye landmarks, ≥5–15° error) | **Peak-time gate** at best (head−torso decoupling). Full-range rear-head nets (DirectMHP ~5.9°, WHENet ~30–38°) exist but are *custom models*, not off-the-shelf. |
| **Neck-vs-torso decoupling** | scan vs shoulder-twist (gold standard) | ❌ | 🟡 peak only | The ideal discriminator is unobservable during the *diagnostic early-turn window*. |
| **Gaze / iris** | where the eyes went | ❌ | ❌ (infeasible at 2–4 m even frontal) | **Out of scope.** Never the primary signal. |

**The hard limit, stated plainly:** no single back-to-camera signal separates a genuine
head-scan from a pure shoulder twist — that separation *biomechanically requires* head or
gaze, which are blind in neutral. The strongest achievable discriminator is a **composite
likelihood**: large torso-yaw **excursion** AND a **ballistic** yaw-rate AND a **rise in
face visibility at the peak** (the face physically rotated toward the screen far enough to
read it). Surface it to users as a *likelihood*, never as proof.

### Biomechanical anchors (cited, verified)
- A "scan" in the sport-science canon is **an active head movement directing the face away
  from the ball** (Jordet). Validated IMU detectors fire only above **125 °/s** (McGuckian
  et al. 2018, *Front. Psychol.* 9:2520) — a real scan has a **ballistic** velocity signature.
- Head-on-neck axial ROM ≈ **70–81°/side**; thoracic axial rotation ≈ **30–35°/side**,
  lumbar negligible. So a **>90° turn to read a screen behind the shoulder cannot come
  from trunk twist alone** — it recruits head + trunk + a stance pivot, which is exactly
  why torso yaw, hip yaw, and their separation are informative (Feipel; sciencedirect
  S0268003311000489).
- A ball-watching head-bob is **small-amplitude and pitch-dominated** → rejected by an
  **amplitude + yaw-axis** gate on a biomechanical basis, without needing to prove eye
  movement.
- ⚠️ Scanning is **eye-driven**: in a 200 Hz soccer eye+head study, gaze correlated 0.98
  with eyes vs 0.90 with head, and eye/head velocities were *negatively* correlated
  (players trade off). The most informative signal (eyes) is the one a 2–4 m phone can
  **never** see, and head/torso motion is an individually-variable, lossy proxy for it
  (biorxiv 2025.09.19.677484, preprint → medium confidence). This is the ceiling on any
  camera-only scanning claim.

---

## 2. The signal-module set & fusion graph

Everything below the `PerceptionBackend` line and above `detectScans` is **pure TS** and
lives in (or beside) `YawFusion.ts`. Each signal is a small, independently-testable pure
function. The fusion graph collapses them into the **same `PoseSample` scalar contract**
the detector already consumes, so `detectScans` and the drill engine never change.

```
                       RawPoseFrame  (captureClockMs, landmarks[], world[], visibility[])
                              │
   ┌──────────────────────────┼───────────────────────────────────────────────┐
   │  SIGNAL EXTRACTORS (pure, per-frame, additive)                            │
   │                                                                           │
   │  S1  shoulderYaw_z   = atan2(sVec.z, sVec.x)         (exists)             │
   │  S2  shoulderYaw_fore= acos(clamp(w_img/w0,0,1))·sign(sVec.z)   NEW  ⚠️    │
   │  S3  hipYaw          = atan2(hVec.z, hVec.x)          NEW                  │
   │  S4  shoulderHipSep  = shoulderYaw − hipYaw           NEW  (discriminator) │
   │  S5  faceVis / facingScreen  = mean+asymmetry of face-landmark visibility  │
   │  S6  headYaw_peak    = IMAGE-plane ear/nose geometry (NOT z) [face-visible] NEW│
   └──────────────────────────┼───────────────────────────────────────────────┘
                              │  visibility-weighted fuse  (S1⊕S2 → torsoYaw)
                              ▼
                     ┌─────────────────┐
                     │  One-Euro filter│  mincutoff 0.8–1.2 Hz, β 0.01–0.02   NEW
                     └────────┬────────┘  (peak lag ~30–80 ms; NOT a Kalman)
                              ▼
                 ┌───────────────────────────┐
                 │  baseline-drift tracker    │  τ 5–15 s, frozen in-scan   NEW
                 │  (quiescence-gated)        │
                 └────────────┬──────────────┘
                              ▼
   PoseSample { tMonoMs, yawDeg, confidence,
                torsoYawDeg?, hipYawDeg?, shoulderHipSepDeg?,   ← additive
                faceVis?, facingScreen?, headYawDeg? }          ← additive
                              │
                              ▼
   detectScans (pure, unchanged decision logic) → ScanEvent {
     tMonoMs (peak), direction, peakYawDeg,
     startMonoMs (yaw-enter crossing), endMonoMs, confidence,  ← exist
     excursionDeg?, peakAngularVelDegPerSec?,                  ← additive
     decoupledDeg?, faceConfirmed? }                           ← additive
                              │
                              ▼
   computeScanVerification → ScanVerification (+ composite halfTurnScore, provenance)
```

### Why the boundaries fall here
- **`YawFusion` is the only place that knows landmarks.** Adding hip yaw, foreshortening,
  filtering, and drift-tracking there means the detector's synthetic-trace tests and the
  drill engine are untouched — the whole intelligence upgrade is one pure module + tests.
- **`detectScans` stays a pure fold over the scalar stream.** New per-event fields
  (`excursionDeg`, `peakAngularVelDegPerSec`, `decoupledDeg`, `faceConfirmed`) are computed
  *alongside* the existing decision, never replacing it — so field-tuned behavior can't
  regress until each new signal is validated and *deliberately* promoted into the gate.
- **The scalar `yawDeg + confidence` contract is the waist of the hourglass.** More signals
  fan in above it; the detector and metrics fan out below it; the waist never widens.

### ⚠️ Corrections that shape the fusion (do not skip these)
- **S2 foreshortening is NOT a drop-in replacement.** `acos(w_img/w0)` is *ill-conditioned
  exactly where it matters* — noise scales as `1/sin(θ)`, so it blows up near neutral (0°)
  and near the 28° enter threshold, is distance-variant in pixels, and NaNs on a
  mis-calibrated `w0`. Use it **fused and mid-range-weighted** to shore up the noisy z
  magnitude, keep **z-sign for direction** (sign survives even when magnitude doesn't), and
  never let it drive the enter crossing alone.
- **S4 decoupling is buildable but unproven.** Hips are low-visibility back-to-camera and
  shoulder−hip is a *difference of two noisy z-derived axial yaws* (MediaPipe's weakest
  plane). Land it as an additive **measured field**, weight shoulder above hip, and gate its
  use on a per-run SNR check — don't wire it into detection until a bench measurement shows
  it clears the depth-noise floor at 2–4 m.
- **S5 face-visibility rise is a hypothesis.** It is architecturally safe (fields already
  slotted) but the empirical premise — that face visibility and L/R asymmetry rise
  *reliably and early* at the peak — is **unmeasured** and corrupted by hair/hood/hat. Ship
  it as a coarse flag with a per-athlete visibility baseline, and validate before it can
  reject a rep.
- **One-Euro, not Kalman.** A predictive Kalman can claw back latency but **overshoots at
  the sharp turn onset/peak** — the exact moment that defines direction and reaction — and
  can mint phantom enter-crossings. Use One-Euro for smoothing and a *separate deterministic
  constant* for latency bias (§4).

---

## 3. The architecture against the frozen seams

```
 drill engine ───sees only──▶ PoseVerifier                 (FROZEN public contract)
                                   │
                          RealPoseVerifier                 (composition shell, dev-build)
                                   │
        ┌───────────────────────────┼────────────────────────────┐
  PerceptionBackend            YawFusion (pure)            detectScans (pure)
  (swappable model)      ┌── signal extractors S1–S6           sees only PoseSample
        │                ├── fuse (S1⊕S2)                      (decision logic frozen;
   ┌────┼─────┬────────┐ ├── OneEuroFilter                      new fields additive)
 MediaPipe MoveNet Null │ ├── baselineDriftTracker
 (primary) (slot) (ExpoGo)└── calibration (neutral, yawSign, w0, faceVisBaseline)
        ┆
   ┆ NEW, LATER (gaze/head-yaw corroborator milestone): a second, PEAK-GATED corroborator backend
   ┆   FaceCorroboratorBackend  (ML Kit head-Euler on v4-frozen v1.10.2,
   ┆                             or patched MediaPipe Face Landmarker iris/gaze)
```

**What changes where, and the size of each change:**

| Layer | Change | Kind |
|---|---|---|
| `PoseVerifier` | none (start/stop/pause/resume unchanged) | frozen |
| `PoseSample` | `+ headYawDeg?` (`hipYawDeg?`/`shoulderHipSepDeg?`/`hipConfidence?` **implemented**; torsoYawDeg/faceVis/facingScreen already existed) | additive type |
| `ScanEvent` | `+ excursionDeg? peakAngularVelDegPerSec? decoupledDeg? faceConfirmed?` (startMonoMs/endMonoMs/confidence exist) | additive type |
| `RawPoseFrame`/`PerceptionBackend` | none for pose; **new optional peak-gated corroborator interface** (corroborator milestone) | additive |
| `YawFusion` | S2/S3/S4 extractors, `OneEuroFilter`, drift tracker, decoupling proxy | **pure — the bulk of the work** |
| `detectScans` | onset reaction, excursion/velocity fields, anticipation, occlusion policy | pure |
| `computeScanVerification` | reaction distribution, direction accuracy, anticipation rate, provenance, composite score | pure |
| `calibration` | `+ w0` (square-on shoulder width), `+ faceVisBaseline`, `+ pipelineLatencyMs` | additive |
| DB | `scan_events` table via appended `user_version 1→2` (3.1); privacy CI guard | additive migration |
| camera layer (native) | thermal fps ladder; optional peak-gated face model | native, isolated in backend files |

---

## 4. Reaction time & anti-cheat (Stream C + F, verified)

This is the metric users see first, and the research yields four concrete, mostly-pure fixes.

1. **Measure cue→movement *onset*, not cue→*peak*.** ✅ *Confirmed, strongest single
   improvement.* The peak is confounded by turn amplitude/speed; onset (first sample where
   |yaw velocity| crosses ~40 °/s, then **linearly back-extrapolate** to the velocity
   zero-crossing) removes 150–300 ms of turn-execution contamination from `avgReactionMs`.
   The detector already tracks `enteredAt`; `startMonoMs` is already slotted on `ScanEvent`.
   Keep the peak stamp as the recorded anchor; drive *reaction* from onset.
2. ⚠️ **Parabolic 3-point interpolation is a *peak* estimator — do not use it for onset.**
   The naive plan misapplied it. Use it (if at all) to refine the *peak* sub-frame; use
   **velocity back-extrapolation** for the onset.
3. **A single per-device pipeline-latency constant `L_pipe`.** `captureClockMs = Date.now()
   − inferenceMs` subtracts only inference, not exposure + ISP + upload, so frames are
   stamped *late* and reaction is inflated. Model it as one constant subtracted in the
   verifier, calibrated once by a **flash/clap test** (§7). ⚠️ It may drift under thermal
   throttling — verify stability across a session before trusting a fixed offset.
4. **Honor the 15 fps floor.** ✅ *Confirmed:* one-frame = 66.7 ms ⇒ **±33 ms** peak
   quantization. Report reaction with a ±33–66 ms band; **do not promise sub-33 ms** while
   the cap stands. `anticipationRate` is robust to aliasing; fine reaction deltas below
   ~50–70 ms are at the noise floor and must not be surfaced as precise.

**Anticipation & sub-human floor** (athletics false-start < 100 ms; simple auditory RT
rarely < 100 ms; a gross whole-body turn is slower):
- onset RT ≤ 0 → **anticipation** (turned before/with the cue),
- 0 < RT < ~150 ms → anticipation/coincidence — reject from the reaction distribution, still
  count the turn,
- ~150–220 ms → flag "suspiciously fast,"
- \> ~220 ms → genuine reaction.

**Occlusion / dropout policy** (pure, in fusion/detector): visibility ≥ 0.5 gate (exists as
`minConfidence`); **hold-last-good ≤ 200 ms then decay confidence to 0** ("lost," not
fabricated-neutral); interpolate a **single** dropped frame only between two high-confidence
frames; **never let a dropout start or end a scan** (require enter/exit crossings on real
samples); prefer high-visibility frames when selecting the peak. Populate `trackedTimeRate`.

**Intra-session baseline drift** (pure): a slow, **quiescence-gated** tracker
(`baseline += k·(yaw − baseline)`, `k ≈ 0.005–0.02` at 15 fps ⇒ τ 5–15 s) updated **only**
when `|yawVel| < ~8 °/s AND not inScan AND confidence ≥ 0.7`, so it tracks postural drift but
can **never chase or erase a real scan** (its τ ≫ scan duration). Drift-correct `w0` the same
way. ⚠️ It does **not** fix the systematic back-to-camera depth bias or front/back
bistability of the *observation itself* — that's a model limit, not a filter's job.

---

## 5. Metrics & the composite score (Stream D, verified — read before building the score)

The sport-science literature is a set of **guardrails against junk metrics** as much as a
source of targets.

- **The core mismatch:** every literature scan number is **head-coded**; HalfTurn measures
  **torso**. Torso yaw **undercounts** real scans. → **Never** display HalfTurn's count as
  "scans/second" beside Jordet's 0.44/s or "Xavi 0.83." Label it a **shoulder-check rate**;
  keep any literature value as separate context, never a target line. There is *no*
  normative torso-yaw scan rate — the mismatch is resolved by **honest labeling**, not a
  better citation.
- **The effect is small.** ✅ *Confirmed:* scan *frequency* explains only **~3–4%** of
  pass-completion/turnover variance (McGuckian 2020, PMC6628054), with a modest full-season
  Bayesian effect (Jordet 2020, PMC7573254). Jordet: *"more than just frequency."* →
  **Down-weight raw frequency**; a score dominated by "more turns = higher" rewards
  ball-watching bobs.
- **What the evidence *does* validate** (build the composite from these, in this order):
  1. **Scanning-before-the-action** (`scannedBeforeActionRate`) — the "explore *before* you
     act" habit is the strongest performance link in the literature (scanning before
     reception rises 0.95→1.44/s approaching the ball; McGuckian 2018). *Predicts pass speed
     & direction, not accuracy* — label accordingly. ⚠️ This is **not** HalfTurn's
     `anticipationRate`: in a *cued* drill, turning *before the cue fires* is **guessing**,
     so `anticipationRate` is a **penalty term** (down-weights the score, excluded from the
     reaction distribution per §4), never a positive lead.
  2. **Direction / blind-side balance** — turning away from pressure / switching play;
     validated via head-turn **excursion**→switch-play (McGuckian 2018).
  3. **Turn-amplitude adequacy** — did the shoulder-check reach a real excursion (the
     drill *requires* a large turn to read the screen).
  4. **Reaction time** — keep, but frame as a **HalfTurn training construct** (the VEB
     canon has *no* cue-reaction metric), not a sport-science norm.
- **Youth targets are trajectory/personal-best**, not elite-anchored (youth scan below
  adults; U19 > U17, U23 > U13).
- **Do not market gaze, field-vision quality, or talent.** Fixations are unseeable (2.3% of
  scans foveate — information is peripheral), and the super-elite-vs-elite scanning
  difference is now **contested** (2024 null replication). Position HalfTurn as training a
  **motor habit**: *turn early, turn both ways, turn far enough, react fast* — exactly what
  an orientation-only signal can legitimately certify.
- **Reliability gating:** surface `meanPoseConfidence` / `trackedTimeRate` / `effectiveFps`
  with every score (the diagnostics ring already computes `effectiveFps` + `meanConfidence`;
  `trackedTimeRate` — the fraction of the drill above the confidence gate — is new);
  **gray out** reaction/direction metrics below minimum sample counts and
  below a tracking-quality floor. Because the back is to the camera, confidence legitimately
  dips — the score must not silently reward noise.

`halfTurnScore` (v1 sketch, all already-slotted metrics): a weighted blend leading with
`scannedBeforeActionRate` and blind-side balance, capped frequency contribution, reaction as
a bounded term, a **penalty** for pre-cue `anticipationRate`, all multiplied by a trust
factor from `trackedTimeRate`. Version it via `metricsVersion`
(in-blob, independent of the DB `user_version` ladder) and document the torso-vs-head caveat
in-code so no downstream consumer mistakes it for a validated VEB measurement.

---

## 6. Backend / signal registry, versioning & provenance (Stream B + E, verified)

- **Keep MediaPipe Pose as the sole continuous backbone on both platforms.** ⚠️ *Verified
  correction:* MoveNet is a **downgrade** (17 2D keypoints, no world-z ⇒ no depth-based
  yaw); Apple Vision body pose is 2D/19-joint (its 3D request is separate + iOS-17-only +
  no maintained RN wrapper); ML Kit pose Z is **pixel-space, not metric**. Only MediaPipe
  yields the metric world-z shoulder/hip vectors the whole pipeline depends on, so
  **cross-platform metric parity requires shipping the same MediaPipe family on iOS and
  Android** (which we already do).
- **Any native/alternate backend is a *separate engine + bumped `metricsVersion`* with its
  own 2D-projection yaw path** — never silently compared against MediaPipe sessions without
  a documented calibration offset.
- **Provenance, populate now:** set `engine` to encode **model id + version + delegate + a
  hash of the `ScanDetectConfig`** (e.g. `mediapipe-pose-lite@0.4.0/gpu/cfg:ab12`), and
  stamp `effectiveFps`, `meanPoseConfidence`, `trackedTimeRate`, and peak thermal state on
  every session. This is the precondition for interpretable old sessions and for A-B testing
  backends as a **pure post-hoc query** grouped by `engine` on the shared drill-clock axis.
- **The peak-gated face corroborator (the corroborator milestone) is a new peak-gated backend behind the same
  boundary.** ⚠️ *Verified correction on buildability:* the maintained
  `react-native-vision-camera-face-detector` (ML Kit head-Euler yaw) `v2.0.5` **requires
  VisionCamera v5 + Nitro — which is blocked**; the only v4-compatible line is the **frozen
  `v1.10.x` (last v1.10.2)**. A MediaPipe Face Landmarker path (`cdiddy77/react-native-mediapipe`
  on VC ^4.5.3) exposes iris + blendshapes but needs an **iOS native Swift patch** to enable
  blendshapes and is effectively unmaintained. So gaze/head-yaw is a **real native line item,
  fired only near the peak (low duty cycle)** to protect the frame budget — not an off-the-shelf
  drop-in, and never the primary signal.

---

## 7. Accuracy & validation plan (Stream F, verified)

A solo developer can build a credible program on ~$0–60 of extra hardware.

**Ground truth (two references):**
1. **Primary — a second phone at 120–240 fps** framing the athlete **and the app's own
   full-screen cue-flash**. Because the reference camera sees both the on-screen cue and the
   movement **on one clock**, it measures **true reaction time directly, with no native
   capture timestamp**, and the app's `captureClockMs` bias is the residual. ⚠️ The 4.2 ms
   frame period (240 fps) is only a *quantization* floor; you must also control display/render
   latency (`firedAtMonoMs`→physical flash) and the peak-stamp-vs-coded-onset mismatch.
2. **Secondary — an IMU/gyro headband** (spare phone or $30–60 logger, **magnetometer-fused**,
   ideally **head *and* trunk**). It is the **only** reference **not blind in the neutral
   state**, so it validates anticipation, direction, and the baseline where camera CV sees
   nothing. Agrees with mocap to single-digit degrees — well inside the 28°/15° hysteresis.
   Note it measures **head** yaw (the target signal), which will *systematically disagree*
   with today's torso signal — decide up front whether acceptance is defined against head,
   torso, or a fused reference.

**Acceptance targets (defensible, sample-sized):**
| Metric | Target | Protocol |
|---|---|---|
| Turn-direction accuracy | **≥ 95%**, Wilson 95% CI | ≥ **150** cued turns, balanced L/R, ≥ 3 athletes, ≥ 3 distances (2/3/4 m), ≥ 2 lighting. ⚠️ "~75 turns → ±5%" only holds *if* ≈95% accurate; 150 is the defensible >90% floor. |
| Scan-count | **P ≥ 0.90, R ≥ 0.90, F1 ≥ 0.90** at ±300–400 ms tolerance | Point-event analog of temporal-IoU; **include a distractor block** of ~30–50 ball-watch bobs + sub-threshold twists to expose false positives. |
| Reaction-time | **MAE ≤ 66 ms, |mean bias| ≤ 33 ms** after a per-device offset | LED/flash protocol; report RSD; do not claim tighter than the 15 fps floor. |
| Tracking coverage | `trackedTimeRate ≥ 0.90`, `effectiveFps ≥ 12` of 15 | else flag low-confidence, don't score. |
| Label reliability | Cohen's **κ ≥ 0.81** (≥ 0.61 floor) | re-code ≥ 10% subset (blinded/second coder). |

**Golden-replay regression gate (two layers), runs inside `npx jest`:**
1. **Pure-TS tripwire:** capture real `RawPoseFrame` streams at the `PerceptionBackend`
   boundary, freeze their `detectScans`/`computeScanVerification` output as JSON fixtures,
   assert equality. ⚠️ `detectScans` over `PoseSample` is genuinely deterministic ("bit-exact");
   the `YawFusion` `atan2` path is *near*-exact across platforms (IEEE-754 leaves `atan2`
   rounding recommended-not-required) — assert with a tight epsilon there, exact in `detectScans`.
2. **Model-swap layer:** on any backend/model change, **re-record** `RawPoseFrame`s for the
   same physical sessions and re-score against the **same frozen human labels**; require the
   acceptance thresholds before the registry default flips.

**Instrumentation prerequisite:** add a dev-only build flag that emits a **full-screen cue-flash
at `firedAtMonoMs`** (and optionally drives an external LED). This doubles as the reaction-bias
probe. This is the first concrete validation task. **[implemented — `CueFlashProbe`; see §10.]**

**Off-device analysis harness [implemented]:** the capture → hand-label → score → gate loop is
built (`src/services/vision/analysis/`, `scripts/analyze-capture.mjs`) and the field runbook that
feeds it is [`field-validation-protocol.md`](./field-validation-protocol.md). It replays a DERIVED
capture through the **frozen** `detectScans`/`computeScanVerification`/`smoothPoseSamples` under
peak/onset/onset+smooth and scores scan-count P/R/F1, direction accuracy (Wilson CI), reaction
MAE/bias (after the L_pipe offset), and `trackedTimeRate` against the two references — reusing the
device functions so a report cannot drift from the app. Committed real fixtures extend the golden
gate (layer 1) to real data (§10).

---

## 8. Privacy & platform posture (Stream E, verified — this is the moat)

- **On-device-only + derived-metrics-only keeps HalfTurn out of the dangerous categories.**
  ⚠️ *Verified nuance:* COPPA "collection" (16 CFR 312.2) is *"gathering… by any means"* — the
  three enumerated modes are **illustrative, not exhaustive**; the correct basis is the FTC's
  interpretive line that *processing which never transmits or persists off-device is not
  collection*. Under **BIPA**, torso/shoulder pose is not on the closed "scan of face/hand
  geometry" list (firmer than the contested Martell "must-identify" rule). Under **GDPR**,
  pose-for-movement is **not Art-9** biometric ("uniquely identifying" is the trigger) — it is
  ordinary personal data while live video exists on-device. The **UK Children's Code** makes
  HalfTurn's defaults (high-privacy default, data-minimisation, no egress) the *model answer*
  — but obliges a **DPIA**.
- **The load-bearing conditions** (all must hold or the position collapses): no raw frame /
  landmark / world stream / face crop / faceprint ever persisted or synced; **no persistent
  identifier** leaves the device via *any* analytics/update/SDK channel; any new
  gaze/head-yaw signal stays a **transient, non-persisted, non-identifying scalar** (a
  `facingScreen` bool / `faceVis` mean — never a face template or iris geometry, which *are*
  enumerated identifiers).
- **Make the boundary a test.** The existing schema already stores only derived metrics + cue
  metadata (no landmark table). Add a **CI guard** (sibling to the Expo-Go guard) that **fails
  if a migration introduces a column/table matching `/landmark|frame|world|faceprint|image_blob/`**.
- **Thermal fps ladder** (a phone in direct sun + continuous GPU CV + max-brightness is a
  worst-case thermal load): poll `ProcessInfo.thermalState` + `AVCaptureDevice.systemPressureState`
  (iOS) and `getThermalHeadroom()` (≤ 1 Hz) + `THERMAL_STATUS` (Android); target 25–30 fps
  nominal → 15 fps fair/serious → 6–10 fps critical, throttling via `activeVideoMinFrameDuration`.
  **Record achieved fps + worst thermal state in provenance** so a degraded run is *flagged, not
  mis-scored* — the peak-anchored metric absorbs lower resolution, it doesn't corrupt it. ⚠️
  Android `getThermalHeadroom()` needs API 30+ and returns NaN if polled faster than ~1 Hz; a
  battery-temp / sustained-fps-drop fallback is needed for older OEMs.
- **Future coach/team sync:** OFF by default, **parental-consent-gated** (COPPA VPC under-13;
  GDPR Art-8 parental consent under-16/member-state floor 13), **derived-metrics-only, never raw
  pose** — which keeps the coach path outside BIPA and GDPR Art-9 entirely. The schema's
  `synced_at`/`server_id`/`dirty`/`deleted_at` columns already make this purely additive.

---

## 9. Roadmap (each milestone additive, shippable, testable, seam-mapped)

Ordered by **leverage ÷ risk**. Every milestone keeps `npx tsc` + `npx jest` + the Expo-Go guard
green, leaves the audio drill + Expo Go path untouched, and changes no pinned dep unless noted.

### Body-signal enrichment + honest reaction (PURE-TS, no backend, no native)
*The whole milestone is inside `YawFusion` + `detectScans` + `calibration` + tests.*
- `OneEuroFilter` pure module + tests. **[implemented]**
- `computeHipYawDeg` + `shoulderHipSeparationDeg`; additive `PoseSample.hipYawDeg` /
  `shoulderHipSepDeg`, threaded through `RealPoseVerifier`. **[implemented]**
- z-free foreshortening estimator `S2`, fused with `S1` (visibility-weighted, mid-range);
  capture `w0` at framing next to `neutralYawBaselineDeg`. **[deferred — needs real traces to
  weight/validate; the capture harness now records them.]**
- `excursionDeg` + `peakAngularVelDegPerSec` on `ScanEvent`; amplitude-primary /
  velocity-confirmatory valid-scan gate to reject ball-watch bobs — computed alongside,
  **not yet gating**, until validated. **[fields implemented + measured; the valid-scan GATE
  stays deferred until validated.]**
- Reaction from **onset** (`startMonoMs`, velocity back-extrapolation); anticipation
  classifier + `anticipationRate`; reaction distribution (median/p25/p75/p90/best) with the
  ±33–66 ms band + min-sample gating. **[implemented behind `reactionMode: 'onset'`
  (env `EXPO_PUBLIC_ENRICH`); default stays peak.]**
- Occlusion policy + quiescence-gated baseline-drift tracker. **[deferred — data-dependent
  tuning (hold/decay/τ/k) needs field traces.]**
- Provenance: enrich `engine` string; populate `meanPoseConfidence`/`effectiveFps` (the
  diagnostics ring already computes these) and add `trackedTimeRate` (new). **[`computeTrackingQuality`
  → trackedTimeRate/meanPoseConfidence/effectiveFps implemented via `PoseVerifier.quality()`;
  richer `engine`-string provenance still pending.]**
- ⚠️ Moving reaction from peak→onset changes `avgReactionMs`, so **bump `metricsVersion`**
  in this milestone (in-blob, no DB migration) so an onset-based reaction blob is never silently compared
  to an older one. **[implemented — metricsVersion 2 in onset mode, 1 in peak mode.]**
- Privacy CI guard on migrations; golden-replay fixture harness. **[golden-replay harness +
  fixture-privacy test implemented; DERIVED-only on-device capture + reassembly script
  implemented — see §10. Migration-column CI guard still pending the `scan_events` table.]**
- **Exit:** new fields populate on real dev-build runs; every new signal has unit tests;
  `avgReactionMs` drops the turn-duration contamination; **zero change to field-tuned
  detection behavior** (new signals measured, not yet promoted); gate green.

### Persisted timeline + validation instrumentation
- `pairCuesToScans` reducer; `scan_events` table via appended `user_version 1→2`
  (mirrors `cue_events` DDL, derived events only); scrubbable timeline + reaction histogram
  on Summary; History badge + sparkline + low-trust graying.
- Dev-only cue-flash build flag (validation instrument, §7). **[implemented as the
  non-occluding cue-reveal reaction marker, `CueFlashProbe` — see §10. Note it is co-timed
  with cue-reveal onset (the correct photons anchor), not the `firedAtMonoMs` instant.]**
- Per-device `L_pipe` constant + one-time flash/clap calibration; store next to
  `CalibrationProfile`; stability check across a session.
- **Exit:** every cue maps to matched/missed/anticipated; timeline survives restart via
  recompute; migration runs clean on an existing v1 DB; old 7-field blobs still parse.

### "Face came around" confirmation (peak-time + thermal ladder)
- `facingScreen`/`faceVis` rise + L/R asymmetry at the peak → `faceConfirmed` on `ScanEvent`;
  per-athlete face-visibility baseline in calibration.
- Peak-gated head-yaw from ear/eye **image** landmarks → head-vs-torso decoupling gate →
  stronger valid-scan + `lookedButWrongCount` scaffolding.
- Composite `halfTurnScore` v1 (anticipation-weighted, frequency-capped); `metricsVersion` bump.
- Thermal fps ladder + provenance (first native-adjacent piece: a thermal module/community pkg).
- **Exit:** a torso-turn-without-a-face-peak is *not* face-confirmed on a ball-watch clip;
  score is reliability-gated; thermal ladder steps fps without crashing; no metric regresses.

### Gaze / head-yaw corroborator (NEW backend, native)
- A **peak-gated** `PerceptionBackend` (ML Kit head-Euler on v4-frozen `v1.10.2`, or a
  patched MediaPipe Face Landmarker for iris/gaze), fired only when `torsoYaw` crosses toward
  `facingScreen`. Stamped as a **separate engine + `metricsVersion`**; A-B vs pose-only.
- Reaction-correctness (`reactionAccuracy`/`lookedButWrongCount`) via tap-the-color (then
  optional on-device ASR), per the turn-and-react spec's open fork.
- Lands alongside the eventual **VisionCamera v5 + Nitro** port (gated on the upstream Xcode-26
  fix) — also just a new backend behind the same seam.
- **Exit:** gaze/head-yaw runs at a bounded duty cycle without breaking the frame budget;
  measurably cuts false positives on a ball-watch clip; nulls cleanly when off; **never** the
  primary anti-anticipation signal.

---

## 10. What is implemented (safe, additive, tested)

Behind the frozen contracts, gate green, audio + Expo-Go path untouched, pinned deps unchanged:
- **`src/services/vision/OneEuroFilter.ts`** — pure, dependency-free speed-adaptive low-pass
  (`mincutoff`/`beta`/`dcutoff`), the §2/§4 smoother, with unit tests (DC-lag identity,
  neutral-jitter suppression, peak-preservation vs a fixed EMA). *Not yet wired into the live
  path* — provided for adoption after on-device tuning.
- **Hip yaw + shoulder–hip separation in `YawFusion`** — `computeHipYawDeg`,
  `shoulderHipSeparationDeg`, threaded onto `FusedReading` and the additive optional
  `PoseSample.hipYawDeg` / `shoulderHipSepDeg`, with tests. Additive **measured fields**; they
  do **not** change `yawDeg` or `detectScans` (per §2's "buildable but unproven — measure
  before promoting").

### Validation instrumentation (§7) — the data-first harness

Dev-only, flag-gated, additive, gate-green — built **before** any enrichment so refinement is
measured, not guessed. Neither changes runtime detection behavior; both are dead in production
and gated off by default in Expo Go / audio mode.

- **Cue-reveal reaction marker** — `src/components/drill/CueFlashProbe.tsx`, gated by
  `CUE_FLASH_ENABLED` (`__DEV__` + `EXPO_PUBLIC_CUE_FLASH=1`), rendered inside
  `TurnReactCueDisplay`'s reveal branch. A **non-occluding** corner patch (`pointerEvents="none"`)
  that flashes for ~90ms **co-timed with the cue the athlete reads** (the reveal commit, via the
  derive-state-during-render pattern) — *not* with `recordCue`, which paints one commit early.
  This is the frame-accurate onset a second phone at 120–240 fps timestamps to recover true
  reaction time and the `firedAtMonoMs → photons` bias. ⚠️ It marks **cue-reveal onset** (the
  correct ground-truth anchor), not the `recordCue`/`firedAtMonoMs` instant.
- **Derived-trace capture + golden-replay gate** — `src/services/vision/frameCapture.ts` (pure),
  gated by `CAPTURE_ENABLED` (`__DEV__` + `EXPO_PUBLIC_CAPTURE=1`). Captures **DERIVED signals
  only** — the `PoseSample` yaw stream + `ScanEvent`s + cue timeline, **never raw frames/landmarks**
  (a non-identifying scalar stream, per §8) — stashed at `RealPoseVerifier.stop()`, completed in
  the engine's `finalize()`, and exported dep-free via chunked `console.log` (reassembled by
  `scripts/collect-capture.mjs`; no size cap, no lossy downsample). The **golden gate**
  (`__fixtures__/syntheticTurnTrace*`, `__tests__/goldenReplay.test.ts`) replays a committed
  **synthetic** frame trace through the **real** `RealPoseVerifier` (a synchronous fake backend)
  → `computeScanVerification`, freezing the output — timestamps/direction/counts/metrics asserted
  exactly, `peakYawDeg` (the lone `atan2` double) via `toBeCloseTo`. A **fixture-privacy test**
  (`__tests__/fixturePrivacy.test.ts`) fails if any committed fixture carries a JSON-serialized
  raw landmark key. This is the A/B baseline the enrichment milestone tunes against.

### Off-device analysis + replay harness (§7) — score real captures against the targets

The data-first tooling that turns a captured `.json` + hand-coded labels into a §7 scorecard,
built so refinement is measured, not guessed. Pure + unit-tested; adds nothing to the app bundle.

- **`src/services/vision/analysis/validationLabels.ts`** — the `ValidationLabels` schema (the JSON
  a coder hand-authors from the 240 fps + IMU references): genuine turns + distractors on the drill
  clock, per-cue `reactionMs` from the cue-flash→onset frame delta, and the per-device
  `pipelineLatencyMs` (L_pipe). Derived scalars only — privacy-safe by the §8 argument.
- **`src/services/vision/analysis/validationReport.ts`** — pure scorers (`scoreScanCounts` P/R/F1
  with one-to-one time+direction matching incl. distractor false-positives; `scoreDirection` +
  Wilson 95% CI; `scoreReaction` MAE/bias/RMSE after the L_pipe offset) and `buildReport` /
  `formatReport`, which **replay through the frozen `detectScans`/`computeScanVerification`/
  `smoothPoseSamples`** under peak/onset/onset+smooth. Reusing the device functions means a report
  reflects exactly what the app produces and cannot silently drift from it. Unit-tested with literal
  known answers (`analysis/__tests__/validationReport.test.ts`).
- **Real-fixture golden gate** — `analysis/__tests__/realFixtureReplay.test.ts` auto-discovers
  committed `__fixtures__/real/<id>.capture.json` (+ labels + a frozen `<id>.expected.json`),
  shape-asserts each capture is derived-only, prints its report in-gate, and asserts the replayed
  peak+onset `ScanVerification` still equals the frozen snapshot — extending the layer-1 tripwire
  from the synthetic trace to **real data**. Empty until the first field session; the machinery is
  green and ready.
- **`scripts/analyze-capture.mjs`** — dep-free CLI: prints a report for any capture (ad-hoc via
  `HT_CAPTURE`), and `--freeze` writes `<id>.expected.json` to promote a session into the gate. It
  delegates the replay to jest so the frozen detector is reused (no re-implementation).
- The field runbook (device flags, ground-truth rig, L_pipe calibration, session matrix, labeling,
  the κ subset) is [`field-validation-protocol.md`](./field-validation-protocol.md).

### Body-signal enrichment + honest reaction (§9) — measured-always, promotions flag-gated

The enrichment milestone, wired so the **default is byte-identical** to prior behavior and every
behavior/metric change is an opt-in A/B pinned in the golden fixtures. Split by risk:

- **Always-on measured fields (no detection/metric change):** `ScanEvent.onsetMonoMs` (movement
  onset via rising-edge velocity back-extrapolation to the neutral crossing, clamped to the rise
  foot), `ScanEvent.excursionDeg` (∫|Δyaw|), `ScanEvent.peakAngularVelDegPerSec` — computed in
  `detectScans` alongside the unchanged decision. `computeTrackingQuality` →
  `ScanVerification.trackedTimeRate` / `meanPoseConfidence` / `effectiveFps` (reliability gating, §5).
- **Flag-gated promotions (default OFF):** `reactionMode: 'onset'` (env `EXPO_PUBLIC_ENRICH`) makes
  `avgReactionMs` cue→ONSET, populates the reaction distribution (median/p25/p75/p90/best,
  min-sample-gated) + `anticipationRate` (pre-cue / sub-150ms turns excluded from the distribution,
  still counted), and **bumps `metricsVersion` to 2** so an onset blob is never silently compared to
  a peak one. One-Euro smoothing of the DETECTION stream (`smoothPoseSamples`, env
  `EXPO_PUBLIC_SMOOTH`) is a separate flag because it changes which scans are detected — kept off
  until on-device tuning. Resolved once as `RUNTIME_ENRICHMENT` and threaded via `RealPoseVerifier`
  (`quality()`, additive optional on `PoseVerifier`) + the engine's `finalize()`.
- **Deferred until real traces exist** (the instrumentation now captures them): the z-free
  foreshortening `S2`, the quiescence-gated baseline-drift tracker, the occlusion hold-last-good
  policy, and promoting hip-decoupling into detection — each needs field data to tune or to clear
  the depth-noise floor, so hip signals stay measured-only.

All of the above are pure or flag-gated, unit-tested (83 green), and keep the **default detection +
metrics byte-identical** — measured signals populate, promotions stay opt-in and A/B-frozen until
validated against real on-device traces.

---

## 10b. FIELD RESULT — the back-turned noise floor (measured, load-bearing)

First real on-device numbers (iPhone dev build, pose **lite**, ~3 m, one athlete, back to camera).
Derived torso yaw was captured during framing and logged:

| stance | MAD | σ (per-frame) |
|---|---:|---:|
| **back to camera** (the drill's neutral) | **8–17°** | **8–21°** |
| turned to the side | **1.0°** | 1.0° |

Same athlete, same distance, same light — **an order of magnitude worse in the one stance the
drill spends all its time in.** The cause is geometric, not environmental: MediaPipe cannot see the
chest of a back-on torso, so the world-**z** the entire yaw derivation rests on (§2, S1) is barely
constrained exactly where we need it. A `flipRate` diagnostic (doubled-angle statistics) was added
to test whether the model was instead flipping its front/back interpretation frame-to-frame:
**measured 0% — that hypothesis is refuted.** It is ordinary jitter.

Three consequences, in increasing order of seriousness:

1. **Framing calibration was a coin flip.** Its thresholds (`maxMadDeg: 15`, `maxDriftDeg: 8`) were
   guesses that landed *on* this noise floor, and `maxDriftDeg` was in fact **smaller than the
   drift that noise alone produces** (SE ≈ 13.6°). So a motionless player was told "too much
   movement." Fixed: the drift test is now noise-relative (drift must exceed `driftSigmas × its
   own drift SE`), the stability gate bounds the **baseline's standard error** rather than raw MAD
   (the quantity that actually matters, and one that scales correctly with sample count), and the
   capture window doubled to 3 s — which alone takes a measured capture from SE 6.8° (rejected) to
   5.3° (accepted) *without the signal improving at all*. The real windows are pinned as fixtures
   (`__fixtures__/realFramingCaptures.ts`).

2. **⚠️ The neutral baseline itself is only good to ~±5°**, and two back-turned captures of the
   same stance differed by 29° in median. Any per-player calibration (§9, the threshold-adaptation
   milestone) must treat the baseline as an *estimate with error*, not a constant.

3. **⚠️⚠️ Phantom-scan risk — the important one.** `DEFAULT_SCAN_DETECT_CONFIG.yawEnterDeg` is
   **28°**, and the neutral-stance noise is σ ≈ 8–21°. That is only **~1.3–3.5σ**: a motionless
   player can cross the scan-enter threshold on noise alone. The hysteresis (`yawExitDeg` 15°),
   the 150 ms hold, and the 400 ms refractory all suppress some of it, but they were never sized
   against a measured noise floor. **This has now been quantified — see §10c. It is worse than
   feared, and it breaks reaction time as well as scan counts.**
   That reframes the §8 benchmark in `perception-architecture.md`: the decisive metric is not fps,
   it is **the neutral-stance noise floor**, and framing's own `sigma`/`baseSE` log lines measure
   it in thirty seconds per arm.

---

## 10c. QUANTIFIED — the shipped detector is not trustworthy (replay, load-bearing)

§10b said "do not trust `scansDetected` until this is quantified." It is now quantified, off-device
and with no phone required, by replaying the **real** captured noise through the **frozen**
`detectScans` at drill length: `analysis/phantomScans.ts`, pinned by
`analysis/__tests__/phantomScans.test.ts`.

**Method.** Take a real back-turned capture, subtract its circular median ⇒ the residuals a
motionless player actually produced (which is exactly what `PoseSample.yawDeg` is). Resample them in
contiguous **blocks** — sensor noise is autocorrelated and `detectScans` requires yaw to stay above
threshold for `minHoldMs`, so an i.i.d. shuffle would destroy the very runs that create phantoms and
would flatter the result. Feed the synthesized stationary stream to the real detector. **The player
never moves, so every scan it reports is false, by construction — no labels, no video, no rig.**

### Two failures, one cause

| | shipped (`yawEnterDeg` 28°) | raised (55°) |
|---|---:|---:|
| phantom scans, motionless player | **21.4 / min** | **0** |
| a real 133° half-turn returns as ONE clean scan | **< 50%** of traces | **95%** (38/40) |
| onset timing SD (⇒ `reactionMs` precision) | **±393 ms** | **±93 ms** |

1. **A motionless player is credited with ~21 scans/min.** A 5-minute drill fires 10–20 cues, so the
   detector currently invents **several times more turns than the player is ever asked to make**.
2. **The same noise shreds real turns.** A 133° half-turn — unmissable — is split into multiple scans,
   so its onset is timed with **SD ±393 ms**. A human reaction time is ~400–700 ms. *The measurement
   error is as large as the quantity being measured:* **`reactionMs` in Turn & React has never
   carried usable signal.** This was invisible because the onset *bias* is a flattering +37 ms — it
   is the **spread** that kills it, and nothing was looking at the spread.

**The control localizes the fault.** The same detector over the side-on capture's noise (σ ≈ 1.8°)
produces **zero** phantoms. The threshold is not globally wrong; it is wrong *for the back-turned
geometry* — the one stance the drill spends all its time in.

### Why raising the threshold is nearly free

**The drill requires a big turn.** The player must come around far enough to read a screen behind
them, and the field capture measured that excursion at **133°**. The stationary noise peaks at
**45°**. There is a canyon between them, and 55–65° sits in it: phantoms → 0 with no loss of recall.

### The rule is NOT `k · σ` — it needs a floor

Fitting the minimum phantom-free threshold against each window's σ gives an implied `k` of **1.9 to
5.6** — it tracks the noise *peak*, not its σ. A σ-scaled threshold is therefore only safe **under a
hard floor and cap**, which is what the clamps in the per-player-threshold milestone (§9) are for.
They are load-bearing, not decoration.

### ⚠️ One-Euro at its default tune makes it WORSE — do not enable it naively

`DEFAULT_ONE_EURO_CONFIG` (minCutoff 1.0, beta 0.015) on the shipped threshold takes phantoms from
**181 → 291** and onset SD to **±1283 ms**. The mechanism is worth understanding, because it is the
opposite of the intuition that reached for the filter: **raw noise spikes are single-frame and die to
the 150 ms hold debounce; smoothing SPREADS them into sustained excursions that now satisfy the
hold.** The filter manufactures the very events it was reached for to suppress. A regression test
pins this so nobody "cleans up the yaw stream" and silently breaks detection.

Smoothing is only safe **on top of** a threshold the noise cannot reach. There it is a genuine win —
tuned in the Casiez order (beta = 0, then lower `minCutoff` against a still athlete's real capture):
`{minCutoff: 0.2, beta: 0}` on the raised threshold takes onset SD **93 → 60 ms** and recovers the
last 2 shredded traces (40/40 clean), still with zero phantoms. It stays **OFF** pending its own
field trace; this is its recorded starting point, not a shipped default.

### Consequences

- **Any `scansDetected`, direction balance, or `reactionMs` recorded before the threshold fix is
  noise and must not be used as a baseline.** Sessions carry their `scanDetectConfig`, so old
  captures can be re-scored — but their *recorded* metrics are void.
- Per-player threshold adaptation (§9) is no longer an enhancement. **It is the fix**, and its
  constants are now fixed by data rather than by guess. See §10d.

---

## 10d. THE FIX — per-player thresholds from the measured noise floor

`services/vision/thresholdAdapt.ts`, behind `EXPO_PUBLIC_ADAPT`. Pure, closed-form, one function of
one measured statistic under hard bounds — no opaque model enters the decision path (§8).

**The statistic** was already being computed and thrown away: `captureStats().sigmaDeg`, the
trend-blind successive-difference noise estimate over the framing screen's 3 s neutral hold. It is
now persisted as `CalibrationProfile.neutralNoiseSigmaDeg` (additive, optional — a profile captured
before this existed reads back `undefined` and keeps today's exact fixed thresholds).

**The derivation.** `yawEnter = clamp(3.5 · σ, 45°, 70°)`, with `yawExit` carried at the shipped
*hysteresis ratio* rather than the shipped fixed gap — a 70° enter with the old 15° exit would demand
the player return to almost dead-neutral to close a scan, which their own noise would prevent, so
the scan would never end.

⚠️ **The clamps are the correctness, not the scaling.** `k · σ` is not a law here: fitting the
minimum phantom-free threshold against each real window's σ gives an implied k of **1.9 to 5.6**,
because the clean threshold tracks the noise's *peak* and the peak-to-σ ratio is not constant. So the
**floor** is what guarantees the phantom-free property when a quiet calibration under-states the
noise the drill will really see, and the **cap** is what guarantees recall. This is only safe at all
because of the canyon the drill's own design creates: **noise peaks at 45°, a real half-turn reaches
133°** (you cannot read a screen behind you without coming that far around).

### Measured end-to-end, on the real captured noise

Framing's own σ → the derived config → replayed through the frozen detector. Not a simulation of the
pipeline; the pipeline's actual functions.

| real capture | measured σ | `yawEnter` | phantoms (still player) | |
|---|---:|---:|---:|---|
| `BACK_TURNED_ACCEPTED` | 8.4° | 28° → **45°** | 3.4/min → **0** | |
| `BACK_TURNED_NOISY` | 21.0° | 28° → **70°** | 37.4/min → **0** | |

And the real 133° half-turn it has to keep finding:

| | shipped | adapted |
|---|---:|---:|
| returns as ONE clean scan | **1 / 40** | **40 / 40** |
| onset timing SD (⇒ `reactionMs`) | **±328 ms** | **±106 ms** |

The threshold that kills every phantom is also the one that finally detects the *real* turn
reliably. Both failures had the same cause, so both have the same fix.

### One thing the data REFUTED, recorded so it does not grow back

The narrow cue gate (`CUE_GATE.neutralMaxYawDeg` = 20°) looked like a second victim of the same
noise: a motionless player reads "back at neutral" in only **61%** of samples, which sounds like it
should hold due cues until the 5 s stall valve. **It does not.** `isReadyForCue` needs only ONE
neutral sample inside its 800 ms staleness window (~9 samples), and 61% per sample means essentially
every window contains one — measured, a due cue is held **0% of the time under both the fixed and the
widened band**. The band is still scaled off the same σ, but as a **consistency** change (two
thresholds on one signal should not disagree about what "still" means), **not** as a bug fix. Pinned
by a test.

### Also corrected here

`EXPO_PUBLIC_SMOOTH` pointed at `DEFAULT_ONE_EURO_CONFIG` — the tune §10c proved makes detection
strictly worse. It now points at `TUNED_ONE_EURO_CONFIG` (`minCutoff 0.2, beta 0`, tuned in the
Casiez order against the real still-athlete captures), which is only safe *because* the threshold
now clears the noise. Still opt-in.

### Status and exit bar

**Flag-gated, default OFF** — it changes which scans are detected, so it does not ship on the
strength of a replay alone, even though the fixed default it replaces is *known* to be broken.
**Exit bar:** on a field trace from a cued session, the adapted arm holds cued-turn recall and
direction accuracy while a cueless distractor block records **zero** scans (§1b, label-free). Then it
is promoted into `DEFAULT_SCAN_DETECT_CONFIG` with a `metricsVersion` bump.

⚠️ **Until then: any `scansDetected`, direction balance, or `reactionMs` recorded under the fixed
default is noise and must not be used as a baseline.**

---

## 11. Open product decisions (need a call — do not block the architecture)

1. **Reaction capture for correctness** — tap-the-color, on-device ASR, or a mapped action?
   Determines whether `reactionAccuracy` ships in the corroborator milestone or stays null. (Biggest fork.)
2. **Ground-truth target definition** — head, torso, or fused? Changes the pass/fail numbers,
   because head-IMU and torso-yaw systematically disagree during a real half-turn.
3. **`anticipationWindowMs`** default (~800 ms) and whether it's per-session — youth vs academy
   legitimately pre-scan.
4. **Minimum sample thresholds** before a metric shows vs nulls (e.g. no median reaction from
   < 3 reactions).
5. **Whether to raise/fork the 15 fps cap** for reaction-critical modes — it is a forkable
   native constant (`minFrameInterval 0.066`) but project memory records the stock MediaPipe
   graph blocks both the uncap and a native capture timestamp; a spike is needed before promising
   sub-frame reaction.

---

## 12. Risk register

| Risk | Mitigation |
|---|---|
| **Shoulder−hip decoupling below the depth-noise floor** at 2–4 m (difference of two noisy z-yaws) | Land as a *measured* field; bench-measure hip-vector z SNR before gating detection; weight shoulder above hip. |
| **Face-visibility-rise doesn't actually rise reliably** at the peak (hair/hood) | Per-athlete visibility baseline; validate on real capture before it can reject a rep; keep it a coarse flag. |
| **Foreshortening estimator ill-conditioned** near 0°/90°, distance-variant | Fuse mid-range only; keep z-sign for direction; NaN-guard `w0`; never drive the enter crossing alone. |
| **`L_pipe` drifts with thermal throttling** → constant offset insufficient | Multi-run stability check via the flash protocol; fall back to per-run offset if drift is large. |
| **15 fps aliases fast turns** → mis-ordered reaction times between athletes | Excursion-primary; report reaction with a ±33–66 ms band; consider the cap fork only if a simulation shows mis-ordering. |
| **Metric over-claim** ("HalfTurn measures scanning/talent") | Honest labeling: "shoulder-check rate," motor-habit framing, frequency down-weighted, gaze explicitly out of scope. |
| **Privacy boundary erodes** via a future feature persisting a frame/identifier | Migration CI guard; DPIA; derived-metrics-only sync gated on parental consent. |
| **v4 face-detector path assumed available** but the maintained line is v5/Nitro | Use the frozen `v1.10.2` or a patched Face Landmarker; treat gaze as native work, peak-gated, never primary. |
```
