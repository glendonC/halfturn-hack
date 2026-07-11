import type { DrillMs, WallMs } from './clocks';
import type { CueId, CueType } from './cues';
import type { VerificationResult } from './verification';

export type DrillMode = 'audio' | 'turn_react';

export interface DrillConfig {
  durationMs: number;
  intervalMs: { min: number; max: number };
  enabledCues: CueType[];
  /**
   * Target share of left checks among directional checks (0–1).
   * 0.5 = balanced blind-side practice. Only affects check_left / check_right picks.
   */
  leftRightBalance: number;
  /** Pre-drill countdown in seconds (0 = none) */
  countdownSec: number;
  /** Speak countdown numbers over TTS to warm the audio path */
  spokenCountdown: boolean;
  haptics: boolean;
  /**
   * Skip repeating the last N cue types when alternatives exist.
   * 0 = allow immediate repeats; default 1.
   */
  avoidLastN: number;
  mode: DrillMode;
  seed?: number;
}

export interface CueEvent {
  id: string;
  cueId: CueId;
  index: number;
  /** Exact phrase spoken / shown (captures resolved color/number). */
  phrase: string;
  onsetWallMs: WallMs;
  onsetDrillMs: DrillMs;
  /** Scheduler's planned drill-clock offset for this cue (may differ from onset if late). */
  plannedOffsetMs: DrillMs;
  /** null in audio-only or when verifier cannot judge */
  verification?: VerificationResult | null;
}

/**
 * Session-level camera/pose verification (production ScanVerification shape).
 * Null on every audio-only / Expo Go session.
 */
export interface ScanVerification {
  scansDetected: number;
  scansPerMinute: number;
  leftScans: number;
  rightScans: number;
  avgReactionMs: number | null;
  scannedBeforeActionRate: number | null;
  engine: string;
  metricsVersion?: number;
  medianReactionMs?: number | null;
  reactionP25Ms?: number | null;
  reactionP75Ms?: number | null;
  reactionP90Ms?: number | null;
  bestReactionMs?: number | null;
  turnDirectionAccuracy?: number | null;
  anticipationRate?: number | null;
  reactionAccuracy?: number | null;
  lookedButWrongCount?: number | null;
  meanPoseConfidence?: number | null;
  effectiveFps?: number | null;
  trackedTimeRate?: number | null;
  halfTurnScore?: number | null;
}

/**
 * Evidence-weighted rollups (METRICS.md). Types only — no algorithms here.
 * Audio-only: rates that require verification stay null (not zero).
 */
export interface ScanMetrics {
  metricsVersion: 1;
  scannedBeforeActionRate: number | null;
  /** Signed (L − R) / (L + R); near 0 = balanced. null if no L/R verified checks */
  blindSideBalance: number | null;
  meanReactionMs: number | null;
  /** Fraction anticipated; higher = worse (penalty) */
  anticipationRate: number | null;
}

export interface SessionMetricsSummary extends ScanMetrics {
  cueCount: number;
  verifiedCount?: number;
  missedCount?: number;
  anticipatedCount?: number;
  unknownCount?: number;
  /** verified / (verified + missed); excludes unknown */
  inWindowVerificationRate?: number | null;
}

export interface DrillSession {
  id: string;
  schemaVersion: 1;
  mode: DrillMode;
  startedAtWallMs: WallMs;
  endedAtWallMs?: WallMs;
  durationDrillMs: DrillMs;
  config: DrillConfig;
  cues: CueEvent[];
  /** Convenience mirror of cues.length; optional denormalized field */
  cueCount?: number;
  metrics?: SessionMetricsSummary | null;
  remoteId?: string | null;
}
