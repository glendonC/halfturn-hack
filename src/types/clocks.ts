/** Wall clock — absolute, for display & sync-ready timestamps */
export type WallMs = number;

/** Drill-monotonic — pauses when session pauses; for reaction timing */
export type DrillMs = number;

export interface DrillClocks {
  wallNow(): WallMs;
  drillNow(): DrillMs;
}
