/**
 * Hand-coded ground-truth labels for a captured session — the human side of the
 * validation harness (docs/field-validation-protocol.md, docs/scan-tracking-architecture.md §7).
 *
 * A {@link DerivedCaptureBundle} carries what the DEVICE derived (yaw samples, detected
 * scans, cue timeline). A {@link ValidationLabels} carries what a HUMAN coded from the two
 * ground-truth references (a second phone at 120-240 fps + an optional IMU headband). The
 * analysis harness (validationReport.ts) scores one against the other → scan-count P/R/F1,
 * turn-direction accuracy, and reaction MAE/bias, all against the §7 acceptance targets.
 *
 * These interfaces ARE the JSON schema the coder authors by hand (one file per session,
 * sibling to the capture `.json`). They are plain derived scalars — no landmarks, no
 * frames, no identifiers beyond a free-form session tag — so a committed label file is
 * privacy-safe by the same argument as the capture bundle (§8) and is covered by the
 * fixture-privacy tripwire.
 *
 * Clock alignment (the load-bearing detail the protocol explains):
 *  - `ValidationLabels.groundTruthTurns[].tMonoMs` is on the DRILL clock (same axis as
 *    `CueEvent.onsetDrillMs`). The coder recovers it from the on-screen cue-flash frames
 *    (`CueFlashProbe`, EXPO_PUBLIC_CUE_FLASH) the reference camera sees: each flash frame is
 *    a known `firedAtMonoMs`, so any video frame maps to drill-ms by counting 240-fps frames
 *    from the nearest flash. Scan-count + direction matching happen on this axis.
 *  - `ValidationLabels.reactions[].reactionMs` is CUE-RELATIVE and therefore clock-agnostic:
 *    it is the flash->movement-onset frame delta straight off the reference video
 *    ((onsetFrame - flashFrame) / fps * 1000). No global alignment needed for reaction.
 */

import type { ScanDirection } from '../types';

/** What a labeled turn's `tMonoMs` marks, so it is matched against the like predicted field. */
export type TurnTimeAnchor = 'peak' | 'onset';

/** One hand-coded turn (or distractor) from the reference video / IMU. */
export interface LabeledTurn {
  /** Ground-truth turn direction (player's left/right), from the face-on peak or the IMU. */
  direction: ScanDirection;
  /**
   * Drill-clock ms of the turn, recovered via the cue-flash frame anchors (see the module
   * header). Matched against a predicted scan's like field (`tMonoMs` for 'peak',
   * `onsetMonoMs` for 'onset') within the count tolerance.
   */
  tMonoMs: number;
  /** Which instant `tMonoMs` marks. Default 'peak' (the reference camera's clearest frame). */
  timeAnchor?: TurnTimeAnchor;
  /**
   * True for a NON-scan the detector must reject (a ball-watch head-bob, a sub-threshold
   * twist — the §7 distractor block). Distractors are never recall targets; a predicted scan
   * landing on one is a false positive surfaced separately (`distractorFalsePositives`).
   */
  distractor?: boolean;
  note?: string;
}

/** Per-cue reaction ground truth: the flash->onset frame delta off the reference video. */
export interface LabeledReaction {
  /** The cue this reaction answers (`CueEvent.index` in the capture bundle). */
  cueIndex: number;
  /**
   * Ground-truth reaction ms = (onsetFrame - flashFrame) / fps * 1000, measured directly on
   * the reference video. Cue-relative, so it needs no drill-clock alignment. A pre-cue /
   * anticipated turn is a NEGATIVE value; record it (the harness classifies it, per §4).
   */
  reactionMs: number;
}

/**
 * The full hand-coded label set for one captured session. `sessionId` is a free-form tag the
 * coder uses to pair this file to its capture bundle (e.g. "athlete2-3m-sun-a"); it is not an
 * identifier that leaves the device with any pose data.
 */
export interface ValidationLabels {
  sessionId: string;
  athlete?: string;
  /** Camera-to-athlete distance for this block, m (2/3/4 per the §7 matrix). */
  distanceM?: number;
  /** Lighting condition tag (e.g. "sun", "overcast", "shade") for the §7 matrix. */
  lighting?: string;
  /** Coder id; add a second coder's file on the >=10% re-code subset for the kappa check. */
  coder?: string;
  /** Every genuine turn + every distractor, hand-coded on the drill clock. */
  groundTruthTurns: LabeledTurn[];
  /** Per-cue reaction ground truth (optional — present when the 240-fps reference was used). */
  reactions?: LabeledReaction[];
  /**
   * Per-device pipeline-latency constant L_pipe (ms), from the flash/clap calibration (§4.3).
   * Subtracted from the app's predicted reaction before scoring, because `captureClockMs`
   * subtracts only inference (not exposure+ISP+upload), so predicted reaction is stamped late.
   * Omit (or 0) to score the raw, uncalibrated bias.
   */
  pipelineLatencyMs?: number;
  notes?: string;
}
