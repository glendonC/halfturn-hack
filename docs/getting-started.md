# Getting started

## Prerequisites

- Node 18+ (tested on Node 24)
- [Expo Go](https://expo.dev/go) for the audio path, or a physical iPhone for Turn & React

## Install and run (audio / Expo Go)

```bash
npm install
npm start
```

Then:

- **Phone:** scan the QR code with Expo Go
- **iOS Simulator:** press `i`
- **Android Emulator:** press `a`

Other scripts:

```bash
npm run ios          # iOS Simulator
npm run android      # Android Emulator
npm run typecheck    # tsc --noEmit
npm run fix-deps     # expo install --fix
```

### iOS audio note

On iPhone, turn the silent/ringer switch **off** before a drill and use the hardware volume buttons. iOS often ignores in-app TTS volume and silences audio when the ringer is on. Use **Test sound** on the Ready screen before you start.

## Expo Go vs Turn & React

| Path | How to run | Vision |
| ---- | ---------- | ------ |
| **Audio + Turn & React preview** | `npm start` → Expo Go | Off. Null verifier only. Beep preview; `verification` stays null. |
| **Native pose** | Custom dev client with `EXPO_PUBLIC_VISION=1` | On-device MediaPipe. Physical device only. |

Native camera modules stay behind a dynamic import and `EXPO_PUBLIC_VISION`. `npm run guard:expo-go` fails CI if they leak into the Expo Go graph.

## Turn & React: build on a physical iPhone

```bash
npm install                 # postinstall fetches the pose model
npm run fetch-model         # if the model was not fetched

# One-time: build the dev client. eas.json `development` bakes in EXPO_PUBLIC_VISION=1.
eas build --profile development --platform ios

# Then run JS against the installed client:
npx expo start --dev-client
```

Local alternative (Mac + Xcode, no EAS):

```bash
EXPO_PUBLIC_VISION=1 npx expo run:ios --device
```

## Field-test checklist (outdoors, with a ball)

1. Mount the phone ~2-4 m away, front camera facing you, screen toward you. Stand with your back/shoulder to the camera in neutral.
2. Setup → Mode → Turn & react → **Set up camera.** Grant camera permission.
3. Framing: back to the phone → Capture center; turn left → Capture left turn. The pill turns green when you are solidly in frame. ("Use last setup" skips this next time.)
4. Drill: watch the full-screen cue; on each beep, half-turn to read the cue, then reset. Keep the self-view tracking ring green.
5. Summary: confirm scan verification shows non-null turns / reaction time when you actually turned.
6. Optional in Profile → Field display: boost brightness, landscape in Turn & React.
7. Dev builds show a small `fps · conf · frames · ms` overlay for sanity checks (~15 fps stock).

Stock pose plugin caps at ~15 fps and exposes no capture timestamp, so reaction time carries a small calibratable bias. See [perception architecture](perception-architecture.md).
