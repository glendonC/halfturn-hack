#!/usr/bin/env node
/**
 * Print a validation report for a DERIVED capture bundle against hand-coded labels — the CLI
 * front-end of the analysis harness (docs/field-validation-protocol.md,
 * docs/scan-tracking-architecture.md §7). Dep-free (Node core only).
 *
 * It does NOT re-implement the detector: it sets HT_CAPTURE/HT_LABELS and runs the jest replay
 * test (`analysis/__tests__/realFixtureReplay.test.ts`), which drives the SAME frozen
 * detectScans/computeScanVerification the app runs — so a report can never drift from the app.
 *
 *   node scripts/analyze-capture.mjs <capture.json> [labels.json]            # print the report
 *   node scripts/analyze-capture.mjs --freeze <capture.json> [labels.json]   # + write <id>.expected.json
 *
 * `--freeze` snapshots the peak+onset ScanVerification next to the capture, promoting it into the
 * golden gate (see src/services/vision/__fixtures__/real/README.md).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANNED_KEYS = ['"landmarks"', '"world"', '"worldLandmarks"', '"visibility"'];

function usage(code) {
  console.error('usage: analyze-capture.mjs [--freeze] <capture.json> [labels.json]');
  process.exit(code);
}

const args = process.argv.slice(2);
let freeze = false;
const positional = [];
for (const a of args) {
  if (a === '--freeze') freeze = true;
  else if (a === '-h' || a === '--help') usage(0);
  else positional.push(a);
}

const [captureArg, labelsArg] = positional;
if (!captureArg) usage(1);

const capturePath = resolve(captureArg);
if (!existsSync(capturePath)) {
  console.error(`capture not found: ${capturePath}`);
  process.exit(1);
}

// Fast, dep-free privacy + shape precheck before spawning jest (defense in depth vs §8).
const rawCapture = readFileSync(capturePath, 'utf8');
const leaked = BANNED_KEYS.filter((k) => rawCapture.includes(k));
if (leaked.length > 0) {
  console.error(`refusing: capture carries raw landmark keys ${leaked.join(', ')} — must be derived-only (§8).`);
  process.exit(1);
}
let bundle;
try {
  bundle = JSON.parse(rawCapture);
} catch (err) {
  console.error(`capture is not valid JSON: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(bundle.samples)) {
  console.error('capture has no `samples` array — is this a DerivedCaptureBundle from collect-capture.mjs?');
  process.exit(1);
}

const env = { ...process.env, HT_CAPTURE: capturePath };
if (labelsArg) {
  const labelsPath = resolve(labelsArg);
  if (!existsSync(labelsPath)) {
    console.error(`labels not found: ${labelsPath}`);
    process.exit(1);
  }
  env.HT_LABELS = labelsPath;
}
if (freeze) env.HT_FREEZE = '1';

const res = spawnSync('npx', ['jest', 'realFixtureReplay'], { stdio: 'inherit', cwd: REPO_ROOT, env });
process.exit(res.status ?? 1);
