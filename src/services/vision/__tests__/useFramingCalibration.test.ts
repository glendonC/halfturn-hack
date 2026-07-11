import { DEFAULT_CALIBRATION } from '../types';
import { useCalibrationStore } from '../calibration';
import { resolveYawSign } from '../YawFusion';

describe('calibration store + yaw sign', () => {
  beforeEach(() => {
    useCalibrationStore.getState().reset();
  });

  it('starts at the default identity profile', () => {
    expect(useCalibrationStore.getState().profile).toEqual(DEFAULT_CALIBRATION);
  });

  it('persists a captured profile in-session', () => {
    useCalibrationStore.getState().setProfile({
      neutralYawBaselineDeg: 12,
      yawSign: -1,
      capturedAtEpochMs: 1000,
    });
    expect(useCalibrationStore.getState().profile.yawSign).toBe(-1);
    expect(useCalibrationStore.getState().profile.capturedAtEpochMs).toBe(1000);
  });

  it('resolveYawSign flips when a left turn measured positive', () => {
    expect(resolveYawSign(0, 26)).toBe(-1);
    expect(resolveYawSign(0, -26)).toBe(1);
  });
});
