import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Profile } from '@/types';
import { zustandStorage } from './storage';

export const DEFAULT_PROFILE: Profile = { displayName: null };

/** A stable-feeling default handle for players who haven't set a name yet. */
export function generateDefaultName(): string {
  // Squid Game vibes — Gi-hun's number.
  return 'Player 456';
}

interface ProfileStore {
  profile: Profile;
  /** Set the display name; empty/whitespace falls back to a fresh default handle. */
  setDisplayName: (name: string) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      setDisplayName: (name) =>
        set((s) => {
          const trimmed = name.trim();
          return { profile: { ...s.profile, displayName: trimmed.length > 0 ? trimmed : generateDefaultName() } };
        }),
      reset: () => set({ profile: DEFAULT_PROFILE }),
    }),
    {
      name: 'halfturn-profile',
      version: 1,
      storage: zustandStorage,
      partialize: (s) => ({ profile: s.profile }),
      // Forward-compatible: fill any newly-added Profile fields with defaults.
      migrate: (persisted) => {
        const p = persisted as { profile?: Partial<Profile> } | undefined;
        return { profile: { ...DEFAULT_PROFILE, ...(p?.profile ?? {}) } };
      },
    },
  ),
);

// Seed a default handle on first run (storage hydrates synchronously), so the
// Home greeting shows a real name instead of an empty "set your name" prompt.
// Remap leftover auto-generated "Player ####" handles to Squid Game's 456.
const currentName = useProfileStore.getState().profile.displayName;
if (currentName === null || (/^Player \d+$/.test(currentName) && currentName !== 'Player 456')) {
  useProfileStore.getState().setDisplayName(generateDefaultName());
}

/** Convenience hook returning just the profile object. */
export const useProfile = (): Profile => useProfileStore((s) => s.profile);
