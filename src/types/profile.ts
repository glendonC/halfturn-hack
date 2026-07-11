/**
 * The player's identity, kept distinct from app-wide `Settings`. It's a separate
 * store so it can grow into real profile data later (avatar, position, handedness)
 * without overloading the preferences model.
 */
export interface Profile {
  /** Display name shown in the Home greeting, or null until the player sets one. */
  displayName: string | null;
}
