import { resolveSpokenText, phraseToSpeakVars } from '../resolveSpokenText';
import type { CueDefinition } from '@/types';

const scanCue: CueDefinition = {
  id: 'scan',
  type: 'scan',
  label: 'Scan',
  description: 'Quick head swivel - take in the whole field or court.',
  spokenLabel: 'Scan',
  hudLabel: 'SCAN',
  category: 'scan',
  side: 'none',
  colorToken: 'cueAction',
};

const colorCue: CueDefinition = {
  id: 'color',
  type: 'color',
  label: 'Color',
  description: 'React to the called color (cone, bib, or target).',
  spokenLabel: 'Color',
  hudLabel: 'COLOR',
  category: 'variable',
  side: 'none',
  colorToken: 'cueVariableColor',
};

const numberCue: CueDefinition = {
  id: 'number',
  type: 'number',
  label: 'Number',
  description: 'React to the called number (player, cone, or target).',
  spokenLabel: 'Number',
  hudLabel: 'NUMBER',
  category: 'variable',
  side: 'none',
  colorToken: 'cueVariableNumber',
};

describe('resolveSpokenText', () => {
  it('uses the catalog spoken label for fixed cues', () => {
    expect(resolveSpokenText(scanCue)).toBe('Scan');
    expect(resolveSpokenText(scanCue, { color: 'blue' })).toBe('Scan');
  });

  it('speaks only the resolved value for variable cues', () => {
    expect(resolveSpokenText(colorCue, { color: 'Blue' })).toBe('Blue');
    expect(resolveSpokenText(numberCue, { number: 17 })).toBe('17');
  });

  it('falls back to spokenLabel when variable vars are missing', () => {
    expect(resolveSpokenText(colorCue)).toBe('Color');
    expect(resolveSpokenText(numberCue, { number: '  ' })).toBe('Number');
  });
});

describe('phraseToSpeakVars', () => {
  it('maps variable phrases into SpeakCueVars', () => {
    expect(phraseToSpeakVars('color', 'Red')).toEqual({ color: 'Red' });
    expect(phraseToSpeakVars('number', '12')).toEqual({ number: '12' });
    expect(phraseToSpeakVars('scan', 'Scan')).toBeUndefined();
  });
});
