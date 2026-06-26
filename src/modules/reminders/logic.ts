/**
 * A legendary/lair action reminder that fires at a fixed initiative count.
 * D&D lair actions trigger on initiative count 20 (losing ties); legendary
 * actions recur each round. The GM registers them and the tracker flags which
 * are due at the current count.
 */
export interface Reminder {
  id: string;
  label: string;
  /** the initiative count this fires at (e.g. 20 for lair actions) */
  count: number;
}

/** Reminders that fire at the given initiative count. Pure — unit-tested. */
export function dueAt(reminders: Reminder[], count: number): Reminder[] {
  return reminders.filter((r) => r.count === count);
}

/** Reminders sorted by initiative count (desc, as initiative ticks down). Pure. */
export function byCount(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
