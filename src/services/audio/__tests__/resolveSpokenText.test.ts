import { resolveSpokenText, phraseToSpeakVars } from '../resolveSpokenText';
import type { CueDefinition } from '@/types';
import { systemRng } from '@/utils/random';

const scanCue: CueDefinition = {
  id: 'scan',
  label: 'Scan',
  shortLabel: 'Scan',
  description: 'Quick head-on-a-swivel scan of the whole pitch.',
  defaultPhrase: 'Scan',
  speak: () => 'Scan',
  category: 'action',
  side: 'none',
  colorToken: 'cueAction',
};

const colorCue: CueDefinition = {
  id: 'color',
  label: 'Color',
  shortLabel: 'Color',
  description: 'React to the called color (cone / bib / target).',
  defaultPhrase: 'Color',
  speak: () => 'Color',
  category: 'variable',
  side: 'none',
  colorToken: 'cueVariableColor',
};

const numberCue: CueDefinition = {
  id: 'number',
  label: 'Number',
  shortLabel: 'Number',
  description: 'React to the called number (find the player / target).',
  defaultPhrase: 'Number',
  speak: () => 'Number',
  category: 'variable',
  side: 'none',
  colorToken: 'cueVariableNumber',
};

describe('resolveSpokenText', () => {
  it('uses the catalog default phrase for fixed cues', () => {
    expect(resolveSpokenText(scanCue)).toBe('Scan');
    expect(resolveSpokenText(scanCue, { color: 'blue' })).toBe('Scan');
  });

  it('speaks only the resolved value for variable cues', () => {
    expect(resolveSpokenText(colorCue, { color: 'Blue' })).toBe('Blue');
    expect(resolveSpokenText(numberCue, { number: 17 })).toBe('17');
  });

  it('falls back to defaultPhrase when variable vars are missing', () => {
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
