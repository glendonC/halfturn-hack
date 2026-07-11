import { isVariableCue } from '@/constants';
import type { CueDefinition } from '@/types';

import type { SpeakCueVars } from './types';

/**
 * Resolve what TTS (or clips) should say for a cue.
 * Fixed cues use defaultPhrase. Variable cues speak only the resolved value.
 */
export function resolveSpokenText(
  cue: CueDefinition,
  vars?: SpeakCueVars,
): string {
  if (isVariableCue(cue.id)) {
    if (cue.id === 'color') {
      const color = vars?.color != null ? String(vars.color).trim() : '';
      if (color !== '') return color;
    }
    if (cue.id === 'number') {
      const num = vars?.number != null ? String(vars.number).trim() : '';
      if (num !== '') return num;
    }
  }

  return cue.defaultPhrase;
}

/** Build SpeakCueVars from a resolved phrase for variable cues. */
export function phraseToSpeakVars(
  cueId: CueDefinition['id'],
  phrase: string,
): SpeakCueVars | undefined {
  if (cueId === 'color') return { color: phrase };
  if (cueId === 'number') return { number: phrase };
  return undefined;
}
