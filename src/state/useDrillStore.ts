/**
 * Production import path for the drill runtime store.
 * Hack still owns the full implementation in drillStore.ts; this re-export
 * lets call sites converge on `useDrillStore` from `@/state/useDrillStore`.
 */
export {
  useDrillStore,
  getDrillAudioEngine,
  getDrillPoseVerifier,
  formatRemainingClock,
  selectCurrentCueLabel,
  selectDrillStatus,
  __setDrillAudioEngineForTests,
  type DrillStatus,
  type DrillStoreState,
  type PersistStatus,
} from './drillStore';
