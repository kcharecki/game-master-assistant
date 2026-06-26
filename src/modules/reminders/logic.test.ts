import { describe, it, expect } from 'vitest';
import { dueAt, byCount, type Reminder } from './logic';

const reminders: Reminder[] = [
  { id: 'a', label: 'Lair: grasping roots', count: 20 },
  { id: 'b', label: 'Dragon legendary action', count: 20 },
  { id: 'c', label: 'Trap resets', count: 10 },
];

describe('dueAt', () => {
  it('returns all reminders at a count', () => {
    expect(dueAt(reminders, 20).map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(dueAt(reminders, 10).map((r) => r.id)).toEqual(['c']);
    expect(dueAt(reminders, 5)).toEqual([]);
  });
});

describe('byCount', () => {
  it('sorts by count desc then label', () => {
    expect(byCount(reminders).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
});
