#!/usr/bin/env node
/**
 * Reassemble a DERIVED capture bundle from a chunked-console Metro log into a fixture
 * JSON. Dev tooling for the validation harness (docs/scan-tracking-architecture.md §7).
 * Dep-free (Node core only). The app, with EXPO_PUBLIC_CAPTURE=1 in a dev build, logs
 * the bundle between [[HT-CAPTURE BEGIN]] / [[HT-CAPTURE END]] as indexed chunks (see
 * src/services/vision/frameCapture.ts). Save the Metro output and run:
 *
 *   node scripts/collect-capture.mjs <metro-log.txt> [out.json]
 *   # or pipe:  pbpaste | node scripts/collect-capture.mjs - out.json
 *
 * The reassembled bundle holds DERIVED signals only (yaw samples, scans, cues) — never
 * raw landmarks; the fixture-privacy test rejects any committed JSON that carries them.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const BEGIN = '[[HT-CAPTURE BEGIN]]';
const END = '[[HT-CAPTURE END]]';
const CHUNK_PREFIX = '[[HT-CAPTURE ';

const [, , inArg, outArg] = process.argv;
if (!inArg) {
  console.error('usage: collect-capture.mjs <metro-log.txt|-> [out.json]');
  process.exit(1);
}

const raw = inArg === '-' ? readFileSync(0, 'utf8') : readFileSync(inArg, 'utf8');
const lines = raw.split(/\r?\n/);

const begin = lines.lastIndexOf(BEGIN);
const end = lines.indexOf(END, begin + 1);
if (begin < 0 || end < 0) {
  console.error(`No ${BEGIN} … ${END} block found in input.`);
  process.exit(1);
}

// Metro prefixes log lines (e.g. "LOG "); slice from the marker so prefixes are dropped.
const indexed = [];
for (const line of lines.slice(begin + 1, end)) {
  const at = line.indexOf(CHUNK_PREFIX);
  if (at < 0) continue;
  const body = line.slice(line.indexOf(']]', at) + 2);
  const seq = line.slice(at + CHUNK_PREFIX.length, line.indexOf(']]', at));
  indexed.push({ seq, body });
}

const json = indexed.map((c) => c.body).join('');
let bundle;
try {
  bundle = JSON.parse(json);
} catch (err) {
  console.error('Reassembled payload is not valid JSON — a chunk was likely dropped.', err.message);
  process.exit(1);
}

const out = outArg ?? 'capture.json';
writeFileSync(out, JSON.stringify(bundle, null, 2));
const nSamples = Array.isArray(bundle.samples) ? bundle.samples.length : '?';
const nScans = Array.isArray(bundle.scans) ? bundle.scans.length : '?';
console.log(`Wrote ${out} — ${indexed.length} chunks, ${nSamples} samples, ${nScans} scans.`);
