import type { Rng } from '@/utils/random';

/** Which shoulder/side a cue refers to. `none` = not directional. */
export type Side = 'left' | 'right' | 'none';

/**
 * How a drill delivers cues.
 * - `audio`: the spoken-cue drill (headphones, eyes-up).
 * - `turn-react`: the turn-and-react camera mode — phone mounted facing the
 *   player, the screen is the cue surface, the resolved value is shown (not
 *   spoken: a directionless beep + haptic is the reaction anchor), and the
 *   camera verifies the half-turn. See docs/turn-and-react-spec.md.
 */
export type DrillMode = 'audio' | 'turn-react';

/**
 * Cue categories drive color-coding and selection logic:
 * - `direction`: check_left / check_right (subject to left/right balance)
 * - `action`: man_on / turn / scan / open_body (do-something cues)
 * - `variable`: color / number (speak a randomized value each time)
 */
export type CueCategory = 'direction' | 'action' | 'variable';

/** The fixed set of cue identifiers. Persisted as strings — keep stable. */
export type CueId =
  | 'check_left'
  | 'check_right'
  | 'man_on'
  | 'turn'
  | 'scan'
  | 'open_body'
  | 'color'
  | 'number';

/** Theme color tokens used to color-code cues (see theme/colors.ts). */
export type CueColorToken =
  | 'cueLeft'
  | 'cueRight'
  | 'cueAction'
  | 'cueAlert'
  | 'cueVariableColor'
  | 'cueVariableNumber'
  | 'cueNeutral';

/** Static catalog entry describing a cue's UI + audio behavior. */
export interface CueDefinition {
  id: CueId;
  /** UI label, e.g. "Check Left". */
  label: string;
  /** Compact label for tight chips, e.g. "Left". */
  shortLabel: string;
  category: CueCategory;
  side: Side;
  /** One-line description of what the player should do. */
  description: string;
  /** Spoken phrase for fixed cues; variable cues randomize via `speak`. */
  defaultPhrase: string;
  /** Resolve the phrase to speak (variable cues use rng). */
  speak: (rng: Rng) => string;
  colorToken: CueColorToken;
}

/** User-tunable configuration for a single drill. */
export interface DrillConfig {
  /** Total drill length, seconds. */
  durationSec: number;
  /** Minimum gap between cues, seconds. */
  intervalMinSec: number;
  /** Maximum gap between cues, seconds. */
  intervalMaxSec: number;
  /** Cue types active for this drill (subset of the enabled vocabulary). */
  enabledCues: CueId[];
  /**
   * Bias for directional cues: 0 = always left, 1 = always right, 0.5 = even.
   * Only affects check_left vs check_right selection.
   */
  leftRightBalance: number;
  /** Avoid firing the same cue id twice in a row. */
  avoidImmediateRepeat: boolean;
  /** Spoken 3-2-1 countdown before the first cue. */
  countdownEnabled: boolean;
  /**
   * Drill delivery mode (see {@link DrillMode}). Defaults to `'audio'`; the
   * Zustand config store merges-with-defaults on migrate, so configs persisted
   * before this field existed read back as `'audio'`.
   */
  mode: DrillMode;
}

/**
 * A single fired cue on the drill timeline. Persisted to its own table so
 * camera reaction-time (cue -> scan latency) is a per-event temporal join.
 *
 * Two clocks are captured deliberately:
 * - `firedAtMonoMs`: drill-clock ms since start, EXCLUDING paused time. This is
 *   the t0-relative monotonic axis that camera scan timestamps normalize onto,
 *   so `latency = scan.tMonoMs - cue.firedAtMonoMs` is a pure subtraction.
 * - `firedAtEpochMs`: wall-clock epoch ms, for display/debugging.
 */
export interface CueEvent {
  /** 0-based order within the session. */
  seq: number;
  cueId: CueId;
  category: CueCategory;
  /** The exact phrase spoken (captures resolved value for variable cues). */
  phrase: string;
  side: Side;
  /** Drill-clock ms since start, excluding paused time (monotonic t0 axis). */
  firedAtMonoMs: number;
  /** Wall-clock epoch ms when the cue fired. */
  firedAtEpochMs: number;
  /** Scheduler's planned offset for this cue, ms since start. */
  plannedOffsetMs: number;
}

export type CueCounts = Partial<Record<CueId, number>>;

export type DrillStatus = 'idle' | 'countdown' | 'running' | 'paused' | 'finished';

/**
 * Camera/pose verification results. Null on every audio-only session; the
 * field exists now so the schema and history UI are ready without a rewrite.
 */
export interface ScanVerification {
  scansDetected: number;
  scansPerMinute: number;
  leftScans: number;
  rightScans: number;
  /** Avg ms from a cue to the next detected scan. */
  avgReactionMs: number | null;
  /** Fraction [0,1] of actions preceded by a scan. */
  scannedBeforeActionRate: number | null;
  /** Pose engine + model id/version used, for reproducibility. */
  engine: string;

  // --- Additive camera metrics (optional, back-compatible).
  // metricsVersion is in-blob and independent of DRILL_SESSION_SCHEMA_VERSION /
  // the SQLite PRAGMA user_version ladder; a missing field means "not measured". ---
  metricsVersion?: number;
  medianReactionMs?: number | null;
  reactionP25Ms?: number | null;
  reactionP75Ms?: number | null;
  reactionP90Ms?: number | null;
  bestReactionMs?: number | null;
  /** Fraction [0,1] of direction cues where the player turned the cued side. */
  turnDirectionAccuracy?: number | null;
  /** Fraction [0,1] of turns started before their cue (guessing). */
  anticipationRate?: number | null;
  /** Fraction [0,1] reacted to the correct on-screen value (null until captured). */
  reactionAccuracy?: number | null;
  lookedButWrongCount?: number | null;
  /** Provenance / trust signals so History can gray out low-quality runs. */
  meanPoseConfidence?: number | null;
  effectiveFps?: number | null;
  trackedTimeRate?: number | null;
  /** Composite "HalfTurn" score (formula owned by the reducer). */
  halfTurnScore?: number | null;
}

/** Current schema version for persisted sessions (bump on breaking changes). */
export const DRILL_SESSION_SCHEMA_VERSION = 1;

/** A completed (or stopped) drill, persisted to history. */
export interface DrillSession {
  id: string;
  /** Epoch ms at drill start. */
  startedAt: number;
  /** Epoch ms at drill end. */
  endedAt: number;
  /** Planned length from config, seconds. */
  plannedDurationSec: number;
  /** Actual elapsed excluding paused time, seconds. */
  actualDurationSec: number;
  /** Snapshot of the config used (history stays meaningful as defaults change). */
  config: DrillConfig;
  totalCues: number;
  cueCounts: CueCounts;
  /** Full cue timeline; may be empty for very short sessions. */
  events: CueEvent[];
  /** True if the drill ran to completion; false if stopped early. */
  completed: boolean;
  /** Schema version for forward-compatible migrations / future cloud sync. */
  schemaVersion: number;
  /** Camera verification, null until camera mode exists. */
  verification: ScanVerification | null;
}

/** Lightweight row for history lists (no events payload). */
export type DrillSessionSummary = Omit<DrillSession, 'events'>;
