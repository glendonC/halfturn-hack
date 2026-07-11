const mockPlay = jest.fn();
const mockSeekTo = jest.fn(async () => undefined);
const mockRemove = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: mockPlay,
    seekTo: mockSeekTo,
    remove: mockRemove,
  })),
}));

describe('beep seam', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPlay.mockClear();
    mockSeekTo.mockClear();
    mockRemove.mockClear();
  });

  it('primes once and replays from the start on playBeep', async () => {
    const { createAudioPlayer } = require('expo-audio') as {
      createAudioPlayer: jest.Mock;
    };
    const { playBeep, primeBeep, releaseBeep } = require('../beep') as {
      playBeep: () => void;
      primeBeep: () => void;
      releaseBeep: () => void;
    };

    primeBeep();
    primeBeep();
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);

    playBeep();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalled();

    releaseBeep();
    expect(mockRemove).toHaveBeenCalled();
  });
});
