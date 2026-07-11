/**
 * Core cue vocabulary. Sport-agnostic spatial / awareness calls.
 * Soccer-flavored labels (e.g. "Man on") are presentation only — see catalog.
 * Variable cues (`color` / `number`) resolve a spoken value at fire time.
 */
export type CueType =
  | 'check_left'
  | 'check_right'
  | 'man_on'
  | 'turn'
  | 'scan'
  | 'open_body'
  | 'color'
  | 'number';

/** Stable id for a cue instance in the catalog; ids === CueType */
export type CueId = CueType;

export type CueSide = 'left' | 'right' | 'none';

/**
 * check — directional shoulder/head check
 * scan — general scan / open awareness
 * action — react / pressure / turn under pressure
 * body — body orientation (open body, etc.)
 * variable — randomized spoken value (color / number)
 */
export type CueCategory = 'check' | 'scan' | 'action' | 'body' | 'variable';

export interface CueDefinition {
  id: CueId;
  type: CueType;
  /** Title-case label for setup / settings chips */
  label: string;
  /** One-line athlete instruction (sport-agnostic; soccer only as example) */
  description: string;
  /**
   * Spoken TTS string for fixed cues.
   * Variable cues use a placeholder; the resolved value is chosen at fire time.
   */
  spokenLabel: string;
  /** Short eyes-free / HUD label (variable cues show the resolved value instead) */
  hudLabel: string;
  category: CueCategory;
  side: CueSide;
}
