import type { CueDefinition } from '@/types';

import type { SpeakCueVars } from './types';

/**
 * Resolve what TTS (or clips) should say for a cue.
 * Core catalog uses spokenLabel; color/number variants append resolved values.
 */
export function resolveSpokenText(
  cue: CueDefinition,
  vars?: SpeakCueVars,
): string {
  if (!vars) return cue.spokenLabel;

  const extras: string[] = [];
  if (vars.color != null && String(vars.color).trim() !== '') {
    extras.push(String(vars.color).trim());
  }
  if (vars.number != null && String(vars.number).trim() !== '') {
    extras.push(String(vars.number).trim());
  }

  if (extras.length === 0) return cue.spokenLabel;
  return `${cue.spokenLabel}. ${extras.join('. ')}`;
}
