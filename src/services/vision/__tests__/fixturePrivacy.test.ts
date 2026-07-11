/**
 * Boundary-as-a-test (docs/scan-tracking-architecture.md §8: "make the boundary a
 * test, not a convention"). Real on-device captures are DERIVED-only (frameCapture.ts)
 * and reassembled to `.json` by scripts/collect-capture.mjs — a DerivedCaptureBundle
 * has only yaw `samples`/`scans`/`cues`, never `landmarks`/`world`/`visibility`. This
 * fails if any committed fixture SOURCE carries a JSON-serialized raw landmark stream —
 * the exact thing the on-device/privacy-first invariant forbids persisting.
 *
 * Scope + limits (honest): it scans committed `.json` AND `.ts` fixtures for the
 * banned keys **as quoted JSON keys** (e.g. `"world"`). The scripted synthetic fixture
 * refers to landmark math via CODE identifiers (`world[...]`, `visibility: VIS`), never
 * as quoted JSON, so it passes — while a raw Metro capture pasted into a `.json` OR a
 * `.ts` (which arrives JSON-quoted) is caught. This is a grep-style tripwire: a
 * deliberately renamed/array-serialized landmark key would evade it and relies on code
 * review. The runtime invariant itself is enforced by construction upstream — the
 * frameCapture buffer is typed to hold only PoseSample scalars, not RawPoseFrames.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, '..', '__fixtures__');
const BANNED_KEYS = ['"landmarks"', '"world"', '"worldLandmarks"', '"visibility"'];

function fixtureSourcesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...fixtureSourcesIn(full));
    else if (name.endsWith('.json') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('fixture privacy — no raw landmark streams committed', () => {
  const files = fixtureSourcesIn(FIXTURES_DIR);

  it('scans the committed fixtures (guard is not vacuous)', () => {
    // The synthetic golden trace lives here; if this is 0 the glob broke and the
    // banned-key check below would pass without reading anything.
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no committed fixture carrying a JSON-serialized raw landmark stream', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const hits = BANNED_KEYS.filter((k) => content.includes(k));
      if (hits.length > 0) offenders.push(`${file}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
