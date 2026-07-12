import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Zustand persist adapter backed by expo-sqlite's kv-store.
 *
 * We use the SYNCHRONOUS variants (getItemSync/setItemSync/removeItemSync) so
 * stores hydrate during the first synchronous render — no flash of default
 * values on the Setup screen (which reads the persisted last-used config on
 * mount). kv-store satisfies zustand's contract: getItem returns string | null.
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
