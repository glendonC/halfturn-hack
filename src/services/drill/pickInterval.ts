/**
 * Inclusive random interval in [min, max] milliseconds.
 */
export function pickIntervalMs(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi === lo) return lo;
  return Math.floor(lo + random() * (hi - lo + 1));
}
