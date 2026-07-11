/**
 * Core cue vocabulary. Sport-agnostic spatial / awareness calls.
 * Soccer-flavored labels (e.g. "Man on") are presentation only — see catalog.
 * Color/number variants can extend CueId later without widening this core set.
 */
export type CueType =
  | 'check_left'
  | 'check_right'
  | 'man_on'
  | 'turn'
  | 'scan'
  | 'open_body';

/** Stable id for a cue instance in the catalog; core ids === CueType for now */
export type CueId = CueType;

export type CueSide = 'left' | 'right' | 'none';

/**
 * check — directional shoulder/head check
 * scan — general scan / open awareness
 * action — react / pressure / turn under pressure
 * body — body orientation (open body, etc.)
 */
export type CueCategory = 'check' | 'scan' | 'action' | 'body';

export interface CueDefinition {
  id: CueId;
  type: CueType;
  /** Title-case label for setup / settings chips */
  label: string;
  /** One-line athlete instruction (sport-agnostic; soccer only as example) */
  description: string;
  /** Spoken TTS string */
  spokenLabel: string;
  /** Short eyes-free / HUD label */
  hudLabel: string;
  category: CueCategory;
  side: CueSide;
}
