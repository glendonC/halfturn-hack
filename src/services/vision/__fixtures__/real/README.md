# Real derived-capture fixtures

Committed **DERIVED-only** captures from real on-device sessions, promoted here so the golden
gate regression-tests the pure detector/metrics against real data — not just the synthetic
trace (`docs/scan-tracking-architecture.md` §7, layer 1). Everything here is scalar yaw
`samples` + `scans` + `cues` + hand-coded labels: **never** raw frames/landmarks (§8). The
fixture-privacy test (`__tests__/fixturePrivacy.test.ts`) recurses into this directory and
fails on any committed JSON carrying a landmark stream; the real-fixture replay test
(`analysis/__tests__/realFixtureReplay.test.ts`) additionally shape-checks every sample.

## One session = up to three files, keyed by a shared `<id>`

| File | Produced by | Contents |
|---|---|---|
| `<id>.capture.json` | device → `scripts/collect-capture.mjs` | a `DerivedCaptureBundle` (derived yaw samples, detected scans, cue timeline, calibration + config + enrichment) |
| `<id>.labels.json` | hand-coded from the 240fps + IMU references | a `ValidationLabels` (genuine turns + distractors, per-cue reactions, `pipelineLatencyMs`) |
| `<id>.expected.json` | `analyze-capture.mjs --freeze` | frozen `{ peak, onset }` `ScanVerification` — the regression tripwire |

`<id>` is any stable slug (e.g. `athlete2-3m-sun-a`). A fixture with a `<id>.expected.json`
is **gated** (its replayed verification must equal the frozen snapshot); one without is only
reported (printed), not asserted.

## Promote a session into the gate

```sh
# 1. collect the derived capture from the Metro log (already derived-only)
node scripts/collect-capture.mjs metro-log.txt src/services/vision/__fixtures__/real/<id>.capture.json

# 2. hand-code labels next to it (see validationLabels.ts for the schema)
#    src/services/vision/__fixtures__/real/<id>.labels.json

# 3. print the report to sanity-check, then freeze the expected snapshot
node scripts/analyze-capture.mjs src/services/vision/__fixtures__/real/<id>.capture.json \
                                 src/services/vision/__fixtures__/real/<id>.labels.json
node scripts/analyze-capture.mjs --freeze \
     src/services/vision/__fixtures__/real/<id>.capture.json \
     src/services/vision/__fixtures__/real/<id>.labels.json

# 4. gate is now live
npx jest realFixtureReplay
```

When a later change deliberately moves the metrics, re-freeze (`--freeze`) so the diff is
reviewed, exactly like the synthetic `syntheticTurnTrace.expected.ts`.
