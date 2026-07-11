# Vision — Athlete intelligence, not a timer with a camera

HalfTurn is a **modular athlete-intelligence system** that happens to ship first as an audio cue drill. The north star is verified scanning behavior under pressure — measured honestly, computed mostly in pure TypeScript, and private by default.

**Product identity is sport-agnostic:** athletes / players across field and court sports. Soccer is a primary use case and a convenient source of cue examples (e.g. “Man on”), not the category. Sport-science illustrations may come from football when useful; the system, metrics, and seams must not assume one sport.

If a decision makes the weekend demo easier but hard-codes MediaPipe into a screen, or treats “cue played” as “athlete scanned,” reject it.

---

## 1. Perception is a swappable backend

Pose estimation is infrastructure, not product identity.

**Freeze early:**

- `PerceptionBackend` — start/stop, frame in → landmark/sample out (or failure)
- `PoseVerifier` — drill-facing API: given cue context + sample stream → verification result
- Pure detectors — scan/half-turn onset over a `YawSample` (later multi-signal) stream

**First concrete stack** can be MediaPipe Pose (lite) on VisionCamera. MoveNet, future Nitro/v5, ExecuTorch, or a server-side research backend in a lab build must be **one adapter away**.

**Rules:**

- UI components never import a pose SDK.
- `DrillEngine` never imports a pose SDK.
- Vision native modules load only behind a platform/dev-client guard so Expo Go keeps the audio path alive via `NullPoseVerifier`.

---

## 2. Honesty over hype

Neutral stance for Turn & React is **back-to-camera**. That means we primarily verify **body/torso reorientation** (shoulder/hip yaw, excursion, timing) — not eye gaze and not “they saw the weak side.”

### We will claim

- Athlete reoriented (yaw excursion past threshold) within a reaction window after a cue
- Timing relative to cue onset (dual clocks)
- Anticipation: movement that starts *before* cue onset in a way that looks like guessing
- Scanned-before-action patterns when the drill defines an action cue after a scan cue
- Blind-side balance across left/right check cues over a session

### We will not claim

- Continuous gaze tracking or “eyes swept the field”
- That audio-only sessions “verified” awareness
- That higher raw scan frequency always means better play (frequency without timing/context is vanity)

Metrics are **evidence-weighted**: scanned-before-action and blind-side balance matter more than count-of-turns. Pre-cue anticipation is a **penalty**, not a reward. Full definitions: [METRICS.md](METRICS.md).

---

## 3. Privacy is a product moat

- On-device by default for capture, pose, and metric derivation.
- Raw frames and landmarks **never** leave the device.
- If sync exists later, only derived metrics / session summaries.
- No silent uploads; no “improve the model” telemetry that ships video off-device in MVP or Phase 2.

Trust is part of the product: players will mount a phone facing themselves. We earn that by never needing their face video in the cloud.

---

## 4. Intelligence lives in pure TypeScript

Native code captures and (optionally) estimates pose. **Judgment** lives behind frozen seams in TS:

| Concern | Why pure TS |
| ------- | ----------- |
| Dual clocks (wall + drill-monotonic) | Deterministic reaction timing, pause-safe |
| Fusion / filtering | Swap filters without native releases |
| Onset-based reaction | Thresholds and windows iterate fast |
| Anticipation policy | Product rules, not SDK features |
| Occlusion policy | Prefer `unknown` over fabricated scores |
| Baseline drift | Per-session neutral calibration |
| Adaptive difficulty | Reads verified timelines, not UI state |
| Drill programs | Compose engines + policies |

Adaptive difficulty, programs, and (later) coach insight sit on **verified session timelines** — not ad-hoc React state.

---

## 5. Phased delivery, seams first

```
Phase 1  Audio MVP          → DrillEngine + AudioCuePlayer + nullable verification
Phase 2  Turn & React       → NullPoseVerifier → real PerceptionBackend
Phase 3  Smarter training   → adaptive policies on verified timelines
Phase 4  Optional sync      → derived metrics only; schema already ready
```

Each phase ships user value **and** hardens the map for the next. We optimize for a demoable MVP this weekend without closing the door on years of athlete intelligence.
