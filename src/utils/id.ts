/**
 * Lightweight unique-ish ID generator (no external uuid dependency).
 * Combines a time component, a monotonic counter, and randomness.
 */

let counter = 0;

export function generateId(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  const seq = counter.toString(36);
  return `${prefix}_${time}${seq}${rand}`;
}

export function sessionId(): string {
  return generateId('sess');
}

/** Prefer {@link generateId}; kept for existing call sites. */
export function createId(prefix = 'id'): string {
  return generateId(prefix);
}
