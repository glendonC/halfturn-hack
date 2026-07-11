# Audio — cue playback notes

HalfTurn Phase 1 uses **on-device TTS** (`expo-speech`) with an app audio session from **`expo-audio`**. No cue WAV/MP3 assets.

## Engines

| Engine | Role |
| ------ | ---- |
| `TtsCueEngine` | Production path for the weekend MVP |
| `ClipCueEngine` | Stub for future recorded voice packs (same `AudioCueEngine` interface) |

Cues are **interruptible**: each `speakCue` stops in-flight speech first so a late/overlapping cue never queues behind a stale one.

## Speech-duration guard

The scheduler also **floors** the gap to the next cue using `estimateSpeechMs(phrase, rate)` (word count × rate-scaled ms + Bluetooth cushion) plus a small utterance pad. That keeps long phrases / slow rates from stacking onsets even when the random interval would otherwise be shorter than the spoken length.

`AudioCueEngine.estimateMs` is the seam: `TtsCueEngine` uses the current voice rate; a future `ClipCueEngine` can return clip durations instead.

## iOS ringer-switch gotcha

On iPhone, the hardware **Silent / Ring** switch mutes many audio categories by default. Field athletes often leave Silent on.

We call `setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', ... })` before speaking so:

1. Cues still play in Silent mode (headphones on the pitch/court).
2. Other headphone audio (music, podcasts) **ducks** instead of hard-stopping when possible.

If cues are silent on device:

1. Confirm headphones / Bluetooth route.
2. Confirm `prepare()` / `configureDrillAudioSession()` ran.
3. Remember: **volume** on native TTS is mostly the hardware volume rocker — `AudioCueEngineOptions.volume` is primarily honored on web.

## Android

`playsInSilentMode` / ringer interaction differs by OEM. Prefer testing with media volume up; ducking uses the same `interruptionMode: 'duckOthers'` setting.
