import {
  GOOD_TRACKING_CONFIDENCE,
  MIN_TRACKING_CONFIDENCE,
  isInFrame,
  trackingLevel,
} from '../visionTuning';

describe('trackingLevel', () => {
  it('treats no/zero/negative signal as "none" (not an alarming "poor")', () => {
    expect(trackingLevel(0)).toBe('none');
    expect(trackingLevel(-1)).toBe('none');
    expect(trackingLevel(NaN)).toBe('none');
  });

  it('buckets by threshold: poor < min <= ok < good <= good', () => {
    expect(trackingLevel(MIN_TRACKING_CONFIDENCE - 0.01)).toBe('poor');
    expect(trackingLevel(MIN_TRACKING_CONFIDENCE)).toBe('ok');
    expect(trackingLevel(GOOD_TRACKING_CONFIDENCE - 0.01)).toBe('ok');
    expect(trackingLevel(GOOD_TRACKING_CONFIDENCE)).toBe('good');
    expect(trackingLevel(1)).toBe('good');
  });
});

describe('isInFrame', () => {
  it('gates at the min tracking confidence', () => {
    expect(isInFrame(MIN_TRACKING_CONFIDENCE - 0.01)).toBe(false);
    expect(isInFrame(MIN_TRACKING_CONFIDENCE)).toBe(true);
    expect(isInFrame(1)).toBe(true);
  });
});
