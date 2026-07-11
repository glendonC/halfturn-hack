import { estimateSpeechMs } from '../estimate';

describe('estimateSpeechMs', () => {
  it('scales with word count and rate', () => {
    const one = estimateSpeechMs('Scan', 1);
    const two = estimateSpeechMs('Man on', 1);
    expect(two).toBeGreaterThan(one);
    expect(estimateSpeechMs('Scan', 2)).toBeLessThan(one);
  });

  it('includes a Bluetooth/dispatch cushion', () => {
    // 1 word at rate 1 => 360 + 350
    expect(estimateSpeechMs('Turn', 1)).toBe(710);
  });

  it('treats empty/whitespace as one word', () => {
    expect(estimateSpeechMs('   ', 1)).toBe(710);
  });
});
