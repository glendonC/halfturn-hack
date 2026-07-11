/**
 * Golden-replay gate for REAL derived captures (docs/scan-tracking-architecture.md §7, layer 1),
 * extending the synthetic tripwire to field data. It:
 *   1. auto-discovers committed `__fixtures__/real/<id>.capture.json` (+ optional labels/expected),
 *   2. shape-asserts each capture is DERIVED-only (no raw landmark stream, §8),
 *   3. prints the full validation report (P/R/F1, direction, reaction MAE/bias) via the harness, and
 *   4. for any fixture with a frozen `<id>.expected.json`, asserts the replayed peak+onset
 *      ScanVerification still equals it — a regression tripwire on real data, not just synthetic.
 *
 * Ad-hoc use (no commit needed): `HT_CAPTURE=path [HT_LABELS=path] npx jest realFixtureReplay`
 * prints a report for any capture file. Add `HT_FREEZE=1` to write its `<id>.expected.json`
 * (what `scripts/analyze-capture.mjs --freeze` drives). With no committed fixtures and no
 * HT_CAPTURE, the suite is a quiet no-op that just confirms the directory is ready.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

import type { DerivedCaptureBundle } from '../../frameCapture';
import type { ValidationLabels } from '../validationLabels';
import { buildReport, formatReport, replayVerifications } from '../validationReport';

const REAL_DIR = join(__dirname, '..', '..', '__fixtures__', 'real');
const CAPTURE_SUFFIX = '.capture.json';

/** The only keys a derived PoseSample may carry — anything else means a raw stream leaked (§8). */
const ALLOWED_SAMPLE_KEYS = new Set([
  'tMonoMs',
  'yawDeg',
  'confidence',
  'torsoYawDeg',
  'faceVis',
  'facingScreen',
  'hipYawDeg',
  'shoulderHipSepDeg',
  'hipConfidence',
]);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Fail if a captured sample carries any non-derived key (belt-and-suspenders with fixturePrivacy). */
function assertDerivedOnly(bundle: DerivedCaptureBundle): void {
  expect(Array.isArray(bundle.samples)).toBe(true);
  for (const s of bundle.samples as unknown as Record<string, unknown>[]) {
    for (const key of Object.keys(s)) {
      if (!ALLOWED_SAMPLE_KEYS.has(key)) {
        throw new Error(`capture sample carries a non-derived key "${key}" — must be derived-only (§8)`);
      }
    }
  }
}

interface RealFixture {
  id: string;
  bundle: DerivedCaptureBundle;
  labels: ValidationLabels;
  expected: { peak: unknown; onset: unknown } | null;
}

function discover(): RealFixture[] {
  if (!existsSync(REAL_DIR)) return [];
  const out: RealFixture[] = [];
  for (const name of readdirSync(REAL_DIR)) {
    if (!name.endsWith(CAPTURE_SUFFIX)) continue;
    const id = name.slice(0, -CAPTURE_SUFFIX.length);
    const labelsPath = join(REAL_DIR, `${id}.labels.json`);
    const expectedPath = join(REAL_DIR, `${id}.expected.json`);
    out.push({
      id,
      bundle: readJson<DerivedCaptureBundle>(join(REAL_DIR, name)),
      labels: existsSync(labelsPath)
        ? readJson<ValidationLabels>(labelsPath)
        : { sessionId: id, groundTruthTurns: [] },
      expected: existsSync(expectedPath) ? readJson(expectedPath) : null,
    });
  }
  return out;
}

const HT_CAPTURE = process.env.HT_CAPTURE;
const HT_LABELS = process.env.HT_LABELS;
const HT_FREEZE = process.env.HT_FREEZE === '1';

describe('real derived-fixture replay (golden gate extension)', () => {
  const fixtures = discover();

  if (HT_CAPTURE) {
    it(`ad-hoc: reports ${basename(HT_CAPTURE)}`, () => {
      const bundle = readJson<DerivedCaptureBundle>(HT_CAPTURE);
      assertDerivedOnly(bundle);
      const labels: ValidationLabels = HT_LABELS
        ? readJson<ValidationLabels>(HT_LABELS)
        : { sessionId: basename(HT_CAPTURE), groundTruthTurns: [] };
      // eslint-disable-next-line no-console
      console.log('\n' + formatReport(buildReport(bundle, labels)));

      if (HT_FREEZE) {
        const outPath = HT_CAPTURE.endsWith(CAPTURE_SUFFIX)
          ? `${HT_CAPTURE.slice(0, -CAPTURE_SUFFIX.length)}.expected.json`
          : HT_CAPTURE.replace(/\.json$/, '.expected.json');
        writeFileSync(outPath, `${JSON.stringify(replayVerifications(bundle), null, 2)}\n`);
        // eslint-disable-next-line no-console
        console.log(`froze expected verification → ${outPath}`);
      }
    });
  }

  if (fixtures.length === 0 && !HT_CAPTURE) {
    it('has the real-fixture directory ready (drop <id>.capture.json to gate it)', () => {
      expect(existsSync(REAL_DIR)).toBe(true);
    });
  }

  for (const f of fixtures) {
    describe(f.id, () => {
      it('is derived-only (no raw landmark stream)', () => {
        assertDerivedOnly(f.bundle);
      });

      it('prints its validation report', () => {
        // eslint-disable-next-line no-console
        console.log('\n' + formatReport(buildReport(f.bundle, f.labels)));
      });

      if (f.expected) {
        it('reproduces the frozen peak + onset verification', () => {
          expect(replayVerifications(f.bundle)).toEqual(f.expected);
        });
      } else {
        it('is report-only until frozen (analyze-capture.mjs --freeze to gate it)', () => {
          expect(f.expected).toBeNull();
        });
      }
    });
  }
});
