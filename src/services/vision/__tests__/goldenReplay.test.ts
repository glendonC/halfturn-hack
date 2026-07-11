/**
 * Golden-replay regression gate (docs/scan-tracking-architecture.md §7, layer 1).
 * Replays a frozen synthetic RawPoseFrame trace through the REAL RealPoseVerifier
 * (via a synchronous fake backend) so the full chain — YawFusion.fuse, the verifier's
 * clock-offset normalization, detectScans (+ measured enrichment), tracking quality,
 * computeScanVerification — is pinned. Any change that moves a scan, a timestamp, a
 * direction, a measured field, or a metric fails here until the fixture is deliberately
 * re-frozen. This is the A/B baseline the enrichment tunes against: the default (peak)
 * output stays fixed while the onset promotion is exercised on the same input.
 */

import { computeScanVerification } from '../scanDetect';
import { DEFAULT_ONE_EURO_CONFIG } from '../OneEuroFilter';
import { RealPoseVerifier } from '../RealPoseVerifier';
import type { ScanEvent, TrackingQuality } from '../types';
import { FakeSyncBackend } from './fakeSyncBackend';
import {
  SYNTHETIC_ACTUAL_DURATION_SEC,
  SYNTHETIC_CALIBRATION,
  SYNTHETIC_CONFIG,
  SYNTHETIC_CUES,
  SYNTHETIC_ENGINE_LABEL,
  SYNTHETIC_FRAMES,
} from '../__fixtures__/syntheticTurnTrace';
import {
  EXPECTED_QUALITY,
  EXPECTED_SCANS,
  EXPECTED_VERIFICATION_ONSET,
  EXPECTED_VERIFICATION_PEAK,
} from '../__fixtures__/syntheticTurnTrace.expected';

/** Run the frozen trace through the real verifier (sessionT0Mono=0, as beginRunning does). */
async function replay(enrichment?: ConstructorParameters<typeof RealPoseVerifier>[4]): Promise<{
  scans: ScanEvent[];
  quality: TrackingQuality | null;
}> {
  const backend = new FakeSyncBackend(SYNTHETIC_FRAMES);
  const verifier = new RealPoseVerifier(
    backend,
    SYNTHETIC_CALIBRATION,
    SYNTHETIC_CONFIG,
    undefined,
    enrichment,
  );
  verifier.start(0);
  const scans = await verifier.stop();
  return { scans, quality: verifier.quality() };
}

describe('golden replay — synthetic turn trace', () => {
  it('reproduces frozen scans, measured enrichment, and quality (default detection)', async () => {
    const { scans, quality } = await replay();

    // The ball-watch bob (|yaw| < 28) is rejected: exactly the two half-turns count.
    expect(scans).toHaveLength(EXPECTED_SCANS.length);
    scans.forEach((s, i) => {
      const e = EXPECTED_SCANS[i];
      expect(s.direction).toBe(e.direction);
      expect(s.tMonoMs).toBe(e.tMonoMs);
      expect(s.startMonoMs).toBe(e.startMonoMs);
      expect(s.endMonoMs).toBe(e.endMonoMs);
      expect(s.onsetMonoMs).toBe(e.onsetMonoMs); // clamp-stable integer
      expect(s.confidence).toBe(e.confidence);
      // Measured-only atan2-derived floats — tolerance, not exact equality.
      expect(s.peakYawDeg).toBeCloseTo(e.peakYawDeg, 6);
      expect(s.excursionDeg).toBeCloseTo(e.excursionDeg, 3);
      expect(s.peakAngularVelDegPerSec).toBeCloseTo(e.peakAngularVelDegPerSec, 2);
    });

    expect(quality).toEqual(EXPECTED_QUALITY);
  });

  it('default (peak) verification is unchanged at metricsVersion 1, plus quality', async () => {
    const { scans, quality } = await replay();
    const verification = computeScanVerification(
      scans,
      SYNTHETIC_CUES,
      SYNTHETIC_ACTUAL_DURATION_SEC,
      SYNTHETIC_ENGINE_LABEL,
      SYNTHETIC_CONFIG,
      { reactionMode: 'peak', quality: quality ?? undefined },
    );
    expect(verification).toEqual(EXPECTED_VERIFICATION_PEAK);
  });

  it('onset (enriched) promotion bumps metricsVersion 2 and flags anticipation', async () => {
    const { scans, quality } = await replay();
    const verification = computeScanVerification(
      scans,
      SYNTHETIC_CUES,
      SYNTHETIC_ACTUAL_DURATION_SEC,
      SYNTHETIC_ENGINE_LABEL,
      SYNTHETIC_CONFIG,
      { reactionMode: 'onset', quality: quality ?? undefined },
    );
    expect(verification).toEqual(EXPECTED_VERIFICATION_ONSET);
  });

  it('One-Euro smoothing changes the detection stream but still finds both turns', async () => {
    const raw = await replay();
    const smoothed = await replay({ smoothing: DEFAULT_ONE_EURO_CONFIG, reactionMode: 'onset' });

    // Still two turns, correct directions — but smoothing rounds the peaks (lower
    // amplitude) and lags them (later peak time), proving it altered the stream.
    expect(smoothed.scans.map((s) => s.direction)).toEqual(['left', 'right']);
    smoothed.scans.forEach((s, i) => {
      expect(Math.abs(s.peakYawDeg)).toBeLessThan(Math.abs(raw.scans[i].peakYawDeg));
      expect(s.tMonoMs).toBeGreaterThan(raw.scans[i].tMonoMs);
    });
  });
});
