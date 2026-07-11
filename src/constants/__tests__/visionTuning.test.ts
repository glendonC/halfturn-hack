import {
  GOOD_TRACKING_CONFIDENCE,
  MIN_TRACKING_CONFIDENCE,
  isInFrame,
  trackingLevel,
} from '../visionTuning';

describe('trackingLevel', () => {
  it('maps confidence buckets', () => {
    expect(trackingLevel(0)).toBe('none');
    expect(trackingLevel(MIN_TRACKING_CONFIDENCE - 0.01)).toBe('poor');
    expect(trackingLevel(MIN_TRACKING_CONFIDENCE)).toBe('ok');
    expect(trackingLevel(GOOD_TRACKING_CONFIDENCE)).toBe('good');
  });
});

describe('isInFrame', () => {
  it('gates on MIN_TRACKING_CONFIDENCE', () => {
    expect(isInFrame(MIN_TRACKING_CONFIDENCE - 0.01)).toBe(false);
    expect(isInFrame(MIN_TRACKING_CONFIDENCE)).toBe(true);
    expect(isInFrame(1)).toBe(true);
  });
});
