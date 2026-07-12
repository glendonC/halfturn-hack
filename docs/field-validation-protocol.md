# HalfTurn: Field Validation Protocol

> Companion to [`scan-tracking-architecture.md`](./scan-tracking-architecture.md) §7 (the
> validation plan + acceptance targets this operationalizes) and the analysis harness in
> `src/services/vision/analysis/`. This is the **human-in-the-loop runbook**: how to run a
> cued on-device session so it produces the DERIVED traces the harness scores, how to
> hand-code the ground truth, and how to turn a session into a committed regression fixture.

The loop is:

```
   phone (dev build, back-to-camera)                 second phone @120-240fps  +  optional IMU
        │  EXPO_PUBLIC_CAPTURE=1                            │  sees the cue-flash + the body
        ▼                                                   ▼
   Metro log (chunked DERIVED bundle)                 reference video / gyro log
        │  scripts/collect-capture.mjs                      │  watch frame-by-frame
        ▼                                                   ▼
   <id>.capture.json  ───────────►  analyze-capture.mjs  ◄───────────  <id>.labels.json (hand-coded)
                                          │  (jest replay through the FROZEN detector)
                                          ▼
                          report: scan-count P/R/F1 · direction · reaction MAE/bias · trackedTimeRate
                                          │  --freeze
                                          ▼
                          __fixtures__/real/<id>.expected.json  (golden regression gate)
```

Nothing raw ever leaves the phone: the capture is **derived scalars only** (yaw samples,
scans, cues), the reference video **stays on the second phone** and is deleted after coding,
and the labels are hand-typed numbers. See §Privacy.

---

## 1. Device build & flags

The camera path needs the **custom EAS dev build on a physical iPhone** (Expo Go is
beep-only, `verification` null). See the `camera-devbuild-state` memory for the pinned
deps + babel shims; the model must be fetched before any build:

```sh
npm run fetch-model                       # BOTH pose_landmarker_{lite,full}.task (~5.5 + 9 MB, gitignored)
eas build --profile development --platform ios
# install the dev build on the iPhone
```

Both pose variants are bundled by one build, and the `__DEV__` **pose-model picker** on the framing
screen swaps the running net live (the library re-creates its detector when the model filename
changes). So a lite-vs-full A/B needs **no rebuild and no Metro restart between arms**: alternate
them (lite → full → lite → full) so thermal drift and fatigue cancel. The dev diagnostics HUD prints
the active variant next to the fps, so a block's numbers can never be attributed to the wrong arm.

Run the drill with these `EXPO_PUBLIC_*` flags (they are read at bundle time; restart Metro
with `npx expo start -c` after changing them):

| Flag | Effect | Use in a validation session |
|---|---|---|
| `EXPO_PUBLIC_VISION=1` | enables the real camera + MediaPipe backend | **required** |
| `EXPO_PUBLIC_CAPTURE=1` | emits the DERIVED capture bundle to the Metro console at drill end | **required** |
| `EXPO_PUBLIC_CUE_FLASH=1` | non-occluding corner patch flashes at cue-reveal onset | **required for reaction ground truth** |
| `EXPO_PUBLIC_ENRICH=1` | on-device reaction = onset (metricsVersion 2) | optional: the harness scores peak *and* onset off one capture regardless, so leave **off** and A/B off-device |
| `EXPO_PUBLIC_SMOOTH=1` | One-Euro on the detection stream | leave **off**: tune the filter off-device first (§10) before it ever gates a rep |

⚠️ Reality that shapes the targets (`mediapipe-latency-reality` memory): the stock plugin is
**hard-capped at ~15 fps** and exposes **no capture timestamp**, so frames are stamped
`Date.now() − inferenceTime` (late by a per-device constant). That is exactly what the L_pipe
offset (§3) and the ±33-66 ms reaction band absorb: do not expect sub-frame reaction.

---

## 1b. The label-free shortcut (use this for A/B work)

The full rig below (§2-§9) is what an **absolute** acceptance number costs. But most decisions :
which pose model, which threshold set, whether a gate regressed anything: are **relative
comparisons**, and those are measurable with **no reference video and no hand-coding at all**,
because a cued drill is **self-labeling**:

- **A `check_left` / `check_right` cue tells the player which way to turn**, so the cue's own `side`
  is a ground-truth direction label that costs nothing. `computeCuedDirectionAccuracy` pairs each
  directional cue to at most one detected turn (one-to-one, forward window) and yields **cued
  direction accuracy** + **cued-turn recall**.
- **A distractor block has no cues at all**, so *any* scan detected in it is by definition a **false
  positive**: the ball-watch-bob false-positive rate needs no video either.
- **fps / confidence / tracking coverage** come straight off the capture (`computeTrackingQuality`).

So: run the drill with directional cues only, capture, and score with **no labels file**:

```sh
node scripts/analyze-capture.mjs <id>.capture.json      # labels are optional
```

The report prints the `cued-*` columns and says `labeled: NONE`.

⚠️ **The confound, stated plainly.** Cued accuracy counts a player who genuinely turns the *wrong
way* as a model miss. That inflates neither arm of an A/B (the same athlete's compliance is a
confound that cancels), so it is honest for comparison: but it is **NOT** the ≥95% acceptance bar
in §7. Only the hand-coded protocol below produces that number. Never quote one as the other; the
report footer repeats this so a pasted scorecard carries its own caveat.

---

## 2. Ground-truth rig

**Primary: a second phone at 120-240 fps** on a small tripod, framing **both** the athlete
and the drill phone's screen (so it sees the `CueFlashProbe` corner flash). Because the
reference camera sees the on-screen cue-flash and the body **on one clock**, it measures true
reaction directly, with no dependence on the app's frame timestamps:

- The flash marks **cue-reveal onset**: the photons the athlete actually reacts to (this is
  the correct anchor; the app's `firedAtMonoMs` is one render commit earlier, which the L_pipe
  offset accounts for).
- **Reaction ground truth is a frame delta**, therefore clock-agnostic:
  `reactionMs = (onsetFrame − flashFrame) / fps × 1000`, coded per cue.
- **Drill-clock alignment for turn times**: each cue's flash frame corresponds to that cue's
  `firedAtMonoMs` (read it from the capture bundle's `cues[]`). Convert any video frame to the
  drill clock from the nearest flash anchor:
  `tMonoMs = cues[N].firedAtMonoMs + (frame − flashFrame_N) / fps × 1000`. Avoid pausing during
  a coded block so the continuous video and the pause-excluding drill clock stay aligned.

**Secondary: an IMU/gyro headband** (a spare phone's gyro or a $30-60 magnetometer-fused
logger, ideally head *and* trunk). It is the only reference **not blind in the neutral state**,
so it validates anticipation, direction, and the baseline where the camera sees nothing. Note
it measures **head** yaw and will systematically disagree with the app's **torso** signal
during a real half-turn: decide up front (open decision §11.2 of the architecture) whether
acceptance is defined against head, torso, or a fused reference, and code direction from the
face-on **peak** frame when using the video alone.

---

## 3. Per-device offset (L_pipe) calibration

The app reports reaction from `firedAtMonoMs`; the true reaction is flash→onset. The gap is a
per-device constant (`Date.now()−inferenceTime` stamp-late + the cue-reveal render delay).
Estimate it once and store it as `pipelineLatencyMs` in the labels; the harness subtracts it
before scoring, and §7's `|bias| ≤ 33 ms` tests that the constant **generalizes**.

Two ways, in order of rigor:

1. **Flash/clap block** (preferred): run ~15-20 cues where you clap (or trigger an LED) the
   instant you see the flash, both captured by the 240 fps camera. The median (app-reported −
   true) over that block **is** L_pipe. It is measured independently of the test turns, so a
   low residual bias on the test session is a real generalization check.
2. **Median-of-session** (pragmatic): run the report with `pipelineLatencyMs: 0`, read the
   **onset** row's `bias`, set `pipelineLatencyMs` to it, re-run. Bias then ≈ 0 by
   construction, so MAE (and the reaction spread) is the meaningful test, not the residual bias.

**Stability**: recompute L_pipe on an early vs late block of the same session; if it drifts
more than the band under thermal load, fall back to a per-block offset and flag it (architecture
§4.3 / risk register).

---

## 4. Session design (sized to the §7 targets)

Cued turns, outdoors, back-to-camera, athlete **2-4 m** from the phone. Balance matters more
than volume; every block is a run of the normal drill with the flags above.

| Dimension | Target coverage | Why |
|---|---|---|
| Cued turns (genuine) | **≥ 150** total, across athletes/distances/lighting | direction accuracy needs ≥150 for a defensible >90% Wilson floor |
| L / R balance | ~50/50 per athlete | detect a per-side sign or bias |
| Athletes | **≥ 3** | body/hair/hood variation |
| Distance | **≥ 3**: 2 m, 3 m, 4 m | foreshortening + confidence fall-off |
| Lighting | **≥ 2**: e.g. bright sun + overcast/shade | tracking-quality floor |
| **Distractor block** | **30-50** ball-watch head-bobs + sub-threshold twists, *no cue* | exposes false positives; these are labeled `distractor: true` and must NOT be detected |

A workable layout: per athlete, 2-3 min at each distance (balanced L/R cued turns) under each
lighting condition, plus one distractor block. Pauses split blocks cleanly (no phantom scans),
but do not pause *inside* a block you will frame-code.

---

## 5. Run a session

1. Mount the drill phone at the distance; frame the athlete back-to-camera; run the framing/
   calibration step so `neutralYawBaselineDeg` + `yawSign` are set.
2. Position the 240 fps phone to see the athlete **and** the drill screen's flash corner.
3. Start recording on the 240 fps phone (and the IMU logger, clocks noted).
4. Run the drill (cued turns, or an un-cued distractor block).
5. On finish, the app emits the capture between `[[HT-CAPTURE BEGIN]]` … `[[HT-CAPTURE END]]`
   in the Metro log. Save that log.

---

## 6. Collect the capture

```sh
node scripts/collect-capture.mjs metro-log.txt <id>.capture.json
# or:  pbpaste | node scripts/collect-capture.mjs - <id>.capture.json
```

`<id>` is a stable slug for the block, e.g. `athlete2-3m-sun-a`. The reassembler validates the
JSON round-trips (a dropped chunk fails loudly) and reports sample/scan counts. The output is a
`DerivedCaptureBundle` (derived-only; the fixture-privacy test rejects any landmark stream).

---

## 7. Hand-code the labels

Watch the 240 fps video frame-by-frame and write `<id>.labels.json`: a `ValidationLabels`
object (schema + field docs in `src/services/vision/analysis/validationLabels.ts`):

- **`groundTruthTurns[]`**: every genuine turn: `direction` (from the face-on peak or the IMU)
  and `tMonoMs` on the drill clock (via the flash anchors, §2). Default `timeAnchor` is `peak`.
  Add every distractor as `{ direction, tMonoMs, distractor: true }`.
- **`reactions[]`**: per cue: `{ cueSeq, reactionMs }` where `reactionMs = (onsetFrame −
  flashFrame)/fps×1000`. Record anticipated/pre-cue turns as **negative** values; the harness
  classifies them.
- **`pipelineLatencyMs`**: the L_pipe from §3.
- **`athlete` / `distanceM` / `lighting` / `coder`**: for pooling per the §7 matrix.

**Label reliability (κ):** have a second coder re-code a blinded **≥ 10%** subset into its own
`<id>.coderB.labels.json`; Cohen's κ ≥ 0.81 (≥ 0.61 floor) qualifies the labels. Disagreements
usually mean the tolerance or the anchor definition needs tightening before scoring.

---

## 8. Analyze

```sh
node scripts/analyze-capture.mjs <id>.capture.json <id>.labels.json
```

This drives the jest replay (`analysis/__tests__/realFixtureReplay.test.ts`), which runs the
capture's RAW samples back through the **frozen** `detectScans` / `computeScanVerification` /
`smoothPoseSamples` under three configs and scores each against the labels:

```
config        scans  P     R     F1    dir%    CI95        MAE    bias   track  fps
peak            …     …     …     …     …       …           …      …      …      …
onset           …     …     …     …     …       …           …      …      …      …
onset+smooth    …     …     …     …     …       …           …      …      …      …
```

Reading it:
- **peak vs onset** share a detection stream, so their `scans / P / R / F1 / dir%` are
  identical; only **reaction** moves. The `peak` MAE/bias is scored against the onset ground
  truth on purpose: it shows the +150-300 ms turn-execution inflation that `onset` removes
  (architecture §4.1). If `onset` clears MAE ≤ 66 / |bias| ≤ 33 and `peak` does not, that is
  the evidence to promote onset.
- **onset+smooth** is the One-Euro A/B: watch whether it changes `F1` (it can drop/shift
  scans) before it is ever allowed to gate a rep. Tune `minCutoff`/`beta` (§10) rather than
  shipping the default blindly.
- **distractor FPs** (targets line) must stay 0: a nonzero count is a ball-watch bob leaking
  through, the signal to tighten the amplitude/velocity gate (still measured-only today).

---

## 9. Promote a session into the golden gate

Once a session's labels are trusted, commit it as a regression fixture so no future detector/
metric change can silently move its numbers (extends the synthetic tripwire to real data):

```sh
cp <id>.capture.json src/services/vision/__fixtures__/real/<id>.capture.json
cp <id>.labels.json  src/services/vision/__fixtures__/real/<id>.labels.json
node scripts/analyze-capture.mjs --freeze \
     src/services/vision/__fixtures__/real/<id>.capture.json \
     src/services/vision/__fixtures__/real/<id>.labels.json      # writes <id>.expected.json
npx jest realFixtureReplay                                        # now gated + printed in-gate
```

See `src/services/vision/__fixtures__/real/README.md`. Re-`--freeze` only as a **deliberate**
reviewed diff when a change is meant to move the metrics.

---

## 10. Refine order (against the gate, once traces exist)

Do these **with** real traces, never blind (architecture §9 deferred list). Each stays additive
behind its flag with a fixture diff + a `metricsVersion` bump if it changes a persisted metric:

1. **One-Euro tuning** (Casiez order): set `beta = 0`, tune `minCutoff` on a *still* athlete's
   capture (kill neutral jitter without lag), then raise `beta` on turn captures (keep the peak
   within <1 frame). Only then let `onset+smooth` beat `onset` on F1 before promoting smoothing.
2. **Onset reaction**: confirm `onset` clears MAE/bias vs the 240 fps ground truth across
   devices; calibrate + stability-check L_pipe (§3) before flipping `EXPO_PUBLIC_ENRICH` on by
   default.
3. **Hip / shoulder-hip decoupling**: bench-measure the hip-vector depth SNR at 2-4 m from the
   captured `hipConfidence` before decoupling gates anything; keep hips measured-only until it
   clears the depth-noise floor.
4. **Foreshortening S2, baseline-drift tracker, occlusion hold-last-good**: tune each against
   captured samples; promote only when its data clears its bar.

---

## Acceptance targets (architecture §7: design against these)

| Metric | Target | Report field |
|---|---|---|
| Turn-direction accuracy | **≥ 95%**, Wilson 95% CI, over ≥ 150 turns | `dir%` + `CI95` |
| Scan-count | **P ≥ 0.90, R ≥ 0.90, F1 ≥ 0.90** at ±300-400 ms | `P / R / F1` (tolerance printed) |
| Reaction time | **MAE ≤ 66 ms, |bias| ≤ 33 ms** after the offset | `MAE / bias` (onset row) |
| Tracking coverage | `trackedTimeRate ≥ 0.90`, `effectiveFps ≥ 12` of 15 | `track / fps` |
| Label reliability | Cohen's **κ ≥ 0.81** | second-coder subset (§7) |

The harness prints a ✓/✗ against each per config; pool distances/lighting per the matrix rather
than judging a single block.

---

## Privacy (non-negotiable, architecture §8)

- The capture bundle is **derived scalars only**: yaw samples + scans + cues, never frames,
  landmarks, world coords, or a face crop. Both the fixture-privacy test and the real-fixture
  replay test fail on a leaked landmark key/shape; `analyze-capture.mjs` refuses one up front.
- The **240 fps reference video never leaves the second phone** and is deleted after coding :
  it is a coding aid, not stored data. Labels are hand-typed derived numbers.
- Youth users: video **never** leaves the device; nothing here changes that.
