# Architecture

Opinionated map for the Expo / React Native app. Scaffold against this; do not invent parallel trees.

---

## Folder map

```
halfturn-hack/
├── app/                          # Expo Router screens (file-based routes)
│   ├── (tabs)/                   # optional later; start simple
│   ├── index.tsx                 # home / start drill
│   ├── setup.tsx                 # session setup
│   ├── session.tsx               # active drill HUD
│   ├── history.tsx               # local session list
│   └── settings.tsx
├── src/
│   ├── components/               # presentational UI only
│   ├── constants/                # cue catalog, defaults, thresholds
│   ├── hooks/                    # React bindings to services/state
│   ├── services/
│   │   ├── audio/                # AudioCuePlayer + TTS implementation
│   │   └── vision/               # PerceptionBackend, PoseVerifier, guards
│   ├── state/                    # session machine / stores (local-first)
│   ├── theme/                    # tokens, typography
│   ├── types/                    # DrillSession, CueEvent, verification…
│   └── utils/                    # clocks, math, id helpers
├── docs/
├── assets/                       # icons, later voice packs
├── README.md
└── ROADMAP.md
```

### Rules of the tree

| Path | May know about | Must not know about |
| ---- | -------------- | ------------------- |
| `app/` | hooks, components, types | pose SDKs, MediaPipe, VisionCamera |
| `components/` | theme, types | services internals, native vision |
| `services/audio/` | `AudioCuePlayer` contract | vision |
| `services/vision/` | backends, verifiers, Expo-Go guards | React screens |
| `state/` + drill engine (utils or services) | types, clocks | UI, pose SDKs |
| Pure detectors | `YawSample` streams | camera frames |

Put the **drill engine** in pure TS under `src/services/` or `src/utils/` (e.g. `services/drill/DrillEngine.ts`) — callable from tests without rendering.

---

## Frozen interfaces (Phase 1 stubs OK)

These names are the contract. Implementations can be thin at first; signatures should stay stable.

### Clocks

```ts
/** Wall clock — absolute, for display & sync-ready timestamps */
type WallMs = number;

/** Drill-monotonic — pauses when session pauses; for reaction timing */
type DrillMs = number;

interface DrillClocks {
  wallNow(): WallMs;
  drillNow(): DrillMs;
}
```

### Audio

```ts
type CueType =
  | 'check_left' | 'check_right' | 'man_on' | 'turn' | 'scan' | 'open_body'
  | 'color' | 'number'; // variable cues — resolve phrase at fire time
type CueId = CueType;

interface CueDefinition {
  id: CueId;
  type: CueType;         // same as id for core catalog
  label: string;         // setup chip, e.g. "Check Left"
  description: string;   // one-line athlete instruction
  spokenLabel: string;   // TTS for fixed cues; placeholder for variable
  hudLabel: string;      // eyes-free HUD, e.g. "LEFT" (variables show resolved value)
  category: 'check' | 'scan' | 'action' | 'body' | 'variable';
  side: 'left' | 'right' | 'none';
}

interface AudioCuePlayer {
  speak(cue: CueDefinition): Promise<void>;
  stop(): void;
  setRate?(rate: number): void;
}
```

Phase 1: `ExpoSpeechCuePlayer`. Phase 3: `RecordedVoicePackPlayer` — same interface.

### Perception & verification

```ts
/** Normalized yaw sample in drill time — backend-agnostic */
interface YawSample {
  drillMs: DrillMs;
  wallMs: WallMs;
  /** Radians or degrees — pick one in constants and stick to it (prefer radians) */
  yaw: number;
  confidence: number; // 0–1
  occluded?: boolean;
}

interface PerceptionBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Push or subscribe — adapter choice; consumers see YawSample streams */
  subscribe(cb: (sample: YawSample | null) => void): () => void;
}

type VerificationOutcome =
  | 'verified'      // reoriented inside reaction window
  | 'missed'        // no qualifying onset in window
  | 'anticipated'   // onset before cue — penalty class
  | 'unknown';      // occlusion / low confidence / backend unavailable

interface VerificationResult {
  outcome: VerificationOutcome;
  onsetDrillMs?: DrillMs;
  reactionMs?: number;      // onset - cue onset (drill clock); negative ⇒ anticipation
  peakExcursion?: number;   // yaw delta from baseline
  confidence?: number;
  backendId: string;        // e.g. 'null' | 'mediapipe_pose_lite'
}

interface PoseVerifier {
  /** Calibrate neutral (back-to-camera) baseline for this session */
  calibrateBaseline(samples: YawSample[]): void;
  /**
   * Evaluate whether the athlete reoriented for this cue.
   * Pure over buffered samples + policy — not a React concern.
   */
  verifyCue(args: {
    cue: CueDefinition;
    cueOnsetDrillMs: DrillMs;
    samples: YawSample[];
    windowMs: { early: number; late: number };
  }): VerificationResult;
}

/** Always available — Expo Go / audio-only / tests */
class NullPoseVerifier implements PoseVerifier {
  calibrateBaseline(): void {}
  verifyCue(): VerificationResult {
    return { outcome: 'unknown', backendId: 'null' };
  }
}
```

### Drill engine

```ts
interface DrillConfig {
  durationMs: number;
  intervalMs: { min: number; max: number };
  cueIds: CueId[];
  seed?: number;
}

interface DrillEngine {
  start(config: DrillConfig, clocks: DrillClocks): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Emits cue onsets in drill time; UI/audio subscribe */
  onCue(cb: (evt: { cue: CueDefinition; drillMs: DrillMs; wallMs: WallMs }) => void): () => void;
}
```

### Persistence

```ts
interface SessionRepository {
  save(session: DrillSession): Promise<void>;
  list(limit?: number): Promise<DrillSession[]>;
  get(id: string): Promise<DrillSession | null>;
}
```

Local implementation first; syncing wrapper later (Phase 4) without changing screens.

---

## Data model sketch

Verification is **nullable** from day one so Phase 1 history rows remain valid when Phase 2 lands.

```ts
interface DrillSession {
  id: string;
  schemaVersion: 1;
  mode: 'audio' | 'turn_and_react';
  startedAtWallMs: WallMs;
  endedAtWallMs?: WallMs;
  durationDrillMs: DrillMs;
  config: DrillConfig;
  cues: CueEvent[];
  /** Session-level rollups; null/omitted until computed */
  metrics?: SessionMetricsSummary | null;
  /** Phase 4 — present only after sync */
  remoteId?: string | null;
}

interface CueEvent {
  id: string;
  cueId: CueId;
  index: number;
  onsetWallMs: WallMs;
  onsetDrillMs: DrillMs;
  /** null in audio-only or when verifier returns nothing useful */
  verification?: VerificationResult | null;
}

interface SessionMetricsSummary {
  metricsVersion: 1;
  cueCount: number;
  verifiedCount?: number;
  missedCount?: number;
  anticipatedCount?: number;
  unknownCount?: number;
  /** Evidence-weighted; see METRICS.md */
  scannedBeforeActionRate?: number | null;
  blindSideBalance?: number | null; // -1..1 or 0..1 — document in METRICS
  meanReactionMs?: number | null;
}
```

### Timeline invariant

A session is a **time-ordered list of `CueEvent`s** plus config. All intelligence features (adaptive difficulty, coach views) consume this timeline — not live React state.

---

## Expo-Go safety

```
services/vision/
  index.ts                 # exports PoseVerifier factory only
  NullPoseVerifier.ts
  createPoseVerifier.ts    # returns Null in Expo Go / audio mode
  backends/
    mediapipe/             # dev-client only; never imported from app routes directly
```

`createPoseVerifier(mode)`:

- `audio` → `NullPoseVerifier`
- `turn_and_react` + native module missing → `NullPoseVerifier` + user-visible “needs dev client”
- `turn_and_react` + module present → real backend

Dynamic import or platform-extension files (`.native.ts`) so Metro does not pull VisionCamera into the Expo Go bundle for the audio path.

---

## Dependency direction

```
app / components
        ↓
     hooks / state
        ↓
  DrillEngine · AudioCuePlayer · PoseVerifier · SessionRepository
        ↓
  PerceptionBackend (optional) · storage · speech
```

Arrows point toward stability. Never invert: backends must not import UI.
