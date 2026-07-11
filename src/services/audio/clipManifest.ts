/**
 * Clip voice-pack seam (Phase 3).
 * Manifest shape only — no large asset dump in the hack MVP.
 */

export interface ClipManifestEntry {
  /** Catalog cue id or special key (e.g. readiness) */
  cueId: string;
  /** Metro require() module id or URI once packs ship */
  assetKey: string;
  /** Optional measured duration; estimateSpeechMs is the fallback */
  durationMs?: number;
}

export interface ClipManifest {
  version: 1;
  /** Pack id for diagnostics / settings */
  packId: string;
  clips: ClipManifestEntry[];
}

export function findClip(
  manifest: ClipManifest | null | undefined,
  cueId: string,
): ClipManifestEntry | null {
  if (!manifest) return null;
  return manifest.clips.find((c) => c.cueId === cueId) ?? null;
}
