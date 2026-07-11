/**
 * Inclusive random interval in [min, max] milliseconds.
 * `floorMs` enforces a practical minimum (e.g. estimated TTS duration).
 */
export function pickIntervalMs(
  min: number,
  max: number,
  random: () => number = Math.random,
  floorMs = 0,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const sampled =
    hi === lo ? lo : Math.floor(lo + random() * (hi - lo + 1));
  return Math.max(sampled, Math.max(0, floorMs));
}
