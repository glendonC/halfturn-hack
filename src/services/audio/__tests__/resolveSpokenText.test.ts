import { resolveSpokenText } from '../resolveSpokenText';
import type { CueDefinition } from '@/types';

const baseCue: CueDefinition = {
  id: 'scan',
  type: 'scan',
  spokenLabel: 'Scan',
  hudLabel: 'SCAN',
  category: 'scan',
  side: 'none',
};

describe('resolveSpokenText', () => {
  it('uses the catalog spoken label by default', () => {
    expect(resolveSpokenText(baseCue)).toBe('Scan');
  });

  it('appends resolved color/number variants when provided', () => {
    expect(resolveSpokenText(baseCue, { color: 'blue' })).toBe('Scan. blue');
    expect(resolveSpokenText(baseCue, { number: 3 })).toBe('Scan. 3');
    expect(resolveSpokenText(baseCue, { color: 'red', number: 'two' })).toBe(
      'Scan. red. two',
    );
  });

  it('ignores empty variant fields', () => {
    expect(resolveSpokenText(baseCue, { color: '  ', number: '' })).toBe('Scan');
  });
});
