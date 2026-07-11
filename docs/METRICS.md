# Metrics — what we measure (and refuse to)

HalfTurn optimizes for **measurement honesty**. A good metric is one we can defend on the field: tied to a cue, a clock, and a body signal we actually observe.

Vanity metrics (raw turn counts, “awareness score” without a definition) are out.

---

## What we will claim

| Claim | Signal basis | Mode |
| ----- | ------------ | ---- |
| Athlete **reoriented** after a cue | Yaw excursion past threshold within reaction window | Turn & React |
| **Reaction time** to cue | Onset of reorientation − cue onset (drill clock) | Turn & React |
| **Anticipation** (guessing) | Qualifying onset *before* cue onset | Turn & React |
| **Scanned-before-action** | Scan/check cue verified before a subsequent action cue | Turn & React (program-dependent) |
| **Blind-side balance** | Left vs right check success/attempt mix over a session | Turn & React |
| Cue was **delivered** | TTS/visual onset logged | All modes |

## What we will not claim

- Continuous **gaze** or “eyes swept the field”
- That the athlete **saw** pressure or space (we see torso/shoulder yaw, not vision)
- That **audio-only** sessions verified scanning (they trained the habit; they did not verify it)
- That **higher scan frequency** alone means better performance
- Perfect accuracy under heavy occlusion — we mark **`unknown`**, we do not invent a pass

**Null vs zero:** rates that require pose verification must stay `null` (or absent) on audio-only and turn-react preview sessions. Never zero-fill “0% scanned” — that reads as measured failure, not “not measured.”

---

## Primary vs secondary signals

### Primary (product-facing, evidence-weighted)

1. **Scanned-before-action rate** — among action cues that were preceded by a scan/check cue in the program, fraction where the scan/check was `verified` before the action onset.
2. **Blind-side balance** — symmetry of verified (or attempted) left vs right checks; chronic one-sided scanning is a coaching flag.
3. **Anticipation rate** — fraction of cues with outcome `anticipated` (penalty).
4. **In-window verification rate** — `verified / (verified + missed)` excluding `unknown`.

### Secondary (diagnostic, not headline scores)

- Mean / median reaction time (ms, drill clock)
- Peak yaw excursion distribution
- Unknown / occlusion rate (session quality flag)
- Raw cue count and session duration (context only)
- Per-cue-type success breakdown

### Not used as success metrics

- Total turns without regard to cues
- Wall-clock fidgeting between cues
- Confidence-weighted “scores” that hide missing data

---

## Definitions

### Dual clocks

- **Wall clock (`wallMs`)** — absolute time; display, history, future sync.
- **Drill clock (`drillMs`)** — monotonic while the session is running; **freezes on pause**. All reaction and anticipation math uses drill time.

### Cue onset

The instant the cue is considered presented: start of TTS utterance and/or visual cue appearance. Logged as both `onsetWallMs` and `onsetDrillMs` on `CueEvent`.

### Reorientation onset

First time in the sample stream where yaw excursion from the **session baseline** (neutral back-to-camera) crosses the configured threshold with sufficient confidence and without occlusion — subject to filter/debounce in the pure detector.

Baseline is calibrated at session start (and may be gently drift-corrected). Absolute compass heading is irrelevant; **delta from neutral** matters.

### Reaction window

For each cue:

```
earlyMs  — how far before cue onset we still attribute movement as anticipation
           (movement in (−earlyMs, 0) relative to cue → anticipated)
lateMs   — how far after cue onset a reorientation still counts as verified
```

```
drillΔ = onsetDrillMs − cueOnsetDrillMs

if occluded / low confidence over the window → unknown
else if drillΔ < 0 (within early bound)      → anticipated
else if 0 ≤ drillΔ ≤ lateMs                  → verified (reactionMs = drillΔ)
else                                         → missed
```

Exact `earlyMs` / `lateMs` / yaw threshold live in `src/constants/` and are versioned with `metricsVersion`.

### Anticipation (penalty)

Movement that looks like a committed half-turn/scan **before** the cue is information the athlete should not have. Counting it as success would reward guessing the RNG.

- Outcome: `anticipated`
- Contributes to **anticipation rate** (higher = worse)
- Does **not** count as verified for scanned-before-action

### Scanned-before-action

Only defined when the drill program emits paired structure, e.g. scan/check cue → (short gap) → action cue (`turn`, `man_on`, etc.).

A pair **passes** when the scan/check cue has `verification.outcome === 'verified'` and that verification onset is before the action cue’s onset (drill clock).

```
scannedBeforeActionRate = passingPairs / eligiblePairs
```

Audio-only mode: this metric is `null` (not zero).

### Blind-side balance

Over a session, for check-left vs check-right cues:

```
L = verified left checks
R = verified right checks
blindSideBalance = (L - R) / (L + R)   // when L+R > 0
```

- Near `0` → balanced
- Near `±1` → one-sided

Alternatively expose a 0–1 “balance score” `1 - abs(L-R)/(L+R)` in UI copy; store the signed ratio for coaching. Document which form is in `SessionMetricsSummary` when implemented (`ARCHITECTURE.md` sketch allows either — pick signed ratio in code and label clearly).

### Unknown / occlusion policy

If the backend cannot see the athlete well enough to judge:

- Outcome: `unknown`
- **Excluded** from verification rate denominators that imply a fair chance to succeed
- **Included** in session quality: high unknown rate → “framing/lighting problem,” not “athlete failed”

Prefer honest gaps over false precision.

---

## Mode matrix

| Metric | Audio MVP | Turn & React |
| ------ | --------- | ------------ |
| Cues delivered | yes | yes |
| Verification outcomes | always null / N/A | yes |
| Reaction / anticipation | no | yes |
| Scanned-before-action | null | yes (if program pairs) |
| Blind-side balance | null | yes |
| Gaze / “saw the field” | never | never |

---

## Versioning

- `DrillSession.schemaVersion` — shape of session documents
- `SessionMetricsSummary.metricsVersion` — formula changes

When formulas change, bump `metricsVersion` and keep old sessions readable. Do not silently rewrite history.
