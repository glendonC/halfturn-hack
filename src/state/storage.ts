import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Zustand persist adapter backed by expo-sqlite's kv-store.
 *
 * Synchronous variants so stores can hydrate on first render without a flash
 * of defaults. Available for config/settings persist as we converge on
 * canonical store shapes.
 */
const syncStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => {
    Storage.setItemSync(name, value);
  },
  removeItem: (name) => {
    Storage.removeItemSync(name);
  },
};

export const zustandStorage = createJSONStorage(() => syncStorage);
