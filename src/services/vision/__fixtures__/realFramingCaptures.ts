/**
 * REAL framing captures, recorded on a physical iPhone dev build (pose lite, ~3 m, back to
 * camera, one athlete). These are the derived yaw windows the `[framing]` dev log emitted — no
 * landmarks, no frames, just the scalar stream (privacy: see docs/scan-tracking-architecture.md §8).
 *
 * They exist because every threshold in `framingAutoCapture` used to be a guess, and the guesses
 * sat ON the real noise floor — so calibration was a coin flip that blamed the player for jitter
 * they did not cause. Pinning the actual field windows means a future retune has to face reality:
 * if a change would reject the still player again, a test says so.
 *
 * THE HEADLINE MEASUREMENT (see `BACK_TURNED_*` vs `TURNED_LEFT`):
 *   back to camera → MAD 8–17°   (σ ≈ 8–21°)
 *   turned to the side → MAD 1.0° (σ ≈ 1.0°)
 * An order of magnitude, same athlete, same distance, same light. MediaPipe cannot see the chest
 * of a back-on torso, so its world-z — the depth component the whole yaw derivation rests on — is
 * barely constrained in exactly the stance this drill calls neutral.
 */

/** Rejected in the field as "too much movement" — while the athlete stood still. */
export const BACK_TURNED_NOISY = [
  163, -169, -140, -145, -177, -174, -156, 173, -155, -139, -131, -114, -110, -150, -172,
];

/** Same athlete, same stance, moments later — accepted. Nothing changed but the noise. */
export const BACK_TURNED_ACCEPTED = [
  -130, -127, -134, -134, -111, -106, -141, -163, -126, -117, -119,
];

/** The same athlete turned to the side. Seventeen times cleaner. */
export const TURNED_LEFT = [97, 96, 98, 99, 100, 99, 98, 100, 101, 103, 100, 100, 100, 99, 102, 102];
