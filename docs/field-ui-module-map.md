# Field-Ready Turn & React: UI & module map

> Companion to [`perception-architecture.md`](./perception-architecture.md)
> (the perception seam) and [`turn-and-react-spec.md`](./turn-and-react-spec.md)
> (the drill scenario). This doc records the **UI + orchestration** refactor that
> made Turn & React field-testable: what each module owns, and why the boundaries
> fall where they do. The perception contracts (`PoseVerifier`, `PoseSample`,
> `PerceptionBackend`, pure `detectScans`/`YawFusion`) are **unchanged**.

## Layers (unchanged principle, now enforced by structure)

```
UI (app/, src/components/)      screens + layouts + cue surface + camera chrome
        │ props only                       — NO pose math, NO vision-camera imports
Drill orchestration (services/drill/)   useDrillEngine + CueScheduler (pure)
        │ DrillModeBehavior                — owns timers/audio/haptics/persistence
        │ PoseVerifier                     — talks to perception via the interface
Vision domain (services/vision/)    PoseVerifier / RealPoseVerifier / scanDetect (pure)
        │ PerceptionBackend                — YawFusion (pure) / calibration / diagnostics
Native bridge (allow-listed only)   CameraVerifierView + backends/MediaPipeBackend
                                    — dynamic-import, VISION_ENABLED-gated, CI-guarded
```

## What moved, what's new (the god-file split)

| Was | Now | Why |
|---|---|---|
| `useDrillEngine.ts` branched `if (mode === 'turn-react')` for cue audio, phrase re-roll, interval floor, verifier + beep prep | **`services/drill/modes/`** — `DrillModeBehavior` (`AudioDrillBehavior`, `TurnReactDrillBehavior`) + `getDrillModeBehavior()`; engine **delegates** | A new mode / adaptive difficulty is a new behavior + one registry line — the engine never changes. Unit-tested with the audio+vision modules mocked. |
| `app/drill/active.tsx` mixed Ready + Countdown + Running views, squircle, and all styles | **thin orchestrator** → `components/drill/{DrillReadyView, DrillCountdownView, AudioDrillLayout, TurnReactLayout, CueSurface, PausedOverlay}` | Screen only wires the engine to the right view/layout; markup + styles are composable and testable in isolation. |
| Squircle self-view inline in `active.tsx` (top-right, no ring) | **`components/camera/{CameraSquircle, TrackingRing, VisionDiagnostics}`** | `CameraSquircle` **owns its own tracking-confidence state**, so ~15fps `onTracking` updates re-render only the squircle — never the cue surface. Uses `LazyCameraVerifier` (dynamic) + pure diagnostics → **no native imports** (guard stays green). |
| `app/drill/framing.tsx` had the capture state machine inline | **`services/vision/useFramingCalibration.ts`** (hook) + pure **`resolveYawSign`** in `YawFusion` | Sign/mirror math is pure + unit-tested; the screen is presentational. |
| Tracking-color thresholds duplicated (framing) / absent (squircle) | **`constants/visionTuning.ts`** — `trackingLevel()` (pure, tested) + `trackingLevelColor()` (theme map, shared) | One source of truth for the in-frame gate and the ring/pill colors; the field-tuning knobs live here, not in components. |

## FaceTime layout (`TurnReactLayout`)

- **Cue surface** (`CueSurface` + `TurnReactCueDisplay`) is full-bleed under everything — maximum outdoor readability.
- **Compact status pill** (remaining time + cue count) floats top-left; the big hero timer is gone from this mode so the player glances, not stares.
- **`CameraSquircle`** floats bottom-right (~116×156, r=28) with the live **tracking ring**; a quiet placeholder replaces it in Expo Go.
- **Quiet transport controls** (`TransportControls compact`) float bottom, translucent over the flood.
- **`VisionDiagnostics`** (`__DEV__ && VISION_ENABLED`) shows fps · conf · frames · ms, polled at ~2fps off the diagnostics ring — never on the frame hot path.

## Opt-in field ergonomics (`src/hooks/`, default off)

- `useDrillBrightness(active)` — max brightness while running, restores on exit. Not camera-gated (works in Expo Go).
- `useTurnReactOrientation(active)` — locks landscape for Turn & React, restores portrait on unmount. Both are isolated, try/caught, and toggled in **Settings → Field display**.

## Invariants preserved

- **Clock contract:** cues stamp `firedAtMonoMs`; scans stamp `tMonoMs` on the same drill-clock axis; reaction time = pure subtraction. Untouched.
- **Expo Go safety:** `npm run guard:expo-go` passes — the only files importing camera/native-CV deps remain the allow-listed, dynamic-imported backend files.
- **Tests:** the 27 original tests still pass; new pure logic (mode strategies, `trackingLevel`, `resolveYawSign`, `summarizeFrameStats`) is covered.
