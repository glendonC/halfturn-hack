# Audio — cue playback notes

HalfTurn Phase 1 uses **on-device TTS** (`expo-speech`) with an app audio session from **`expo-audio`**. Cue WAVs are limited to the small turn-react onset beep — no voice-pack dump.

## Engines

| Engine | Role |
| ------ | ---- |
| `TtsCueEngine` | Production path for the weekend MVP |
| `ClipCueEngine` | Seam for future recorded voice packs (same `AudioCueEngine` interface; TTS fallback when a clip is missing) |

Cues are **interruptible**: each `speakCue` stops in-flight speech first so a late/overlapping cue never queues behind a stale one. That keeps the timeline honest when a cue fires before the previous utterance would have finished — the speech-duration **floor** is the other half of that contract (prefer not to interrupt; if we must, interrupt rather than queue).

## Speech-duration guard

The scheduler also **floors** the gap to the next cue using `estimateSpeechMs(phrase, rate)` (word count × rate-scaled ms + Bluetooth cushion) plus a small utterance pad. That keeps long phrases / slow rates from stacking onsets even when the random interval would otherwise be shorter than the spoken length.

`AudioCueEngine.estimateMs` is the seam: `TtsCueEngine` uses the current voice rate; a future `ClipCueEngine` can return clip durations instead.

## Onset beep (turn-react)

`primeBeep` / `playBeep` / `releaseBeep` play a short Expo-Go-safe `assets/sounds/beep.wav` via `expo-audio`. Audio-mode MVP does **not** beep on every cue (TTS is the signal). Turn-react primes and plays the beep as the directionless reaction anchor.

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
