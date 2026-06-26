import { describe, it, expect } from 'vitest';
import { generateRecap } from './recap';
import type { Note } from './logic';

const note = (id: string, at: number, body: string): Note => ({ id, at, body, tags: [] });

describe('generateRecap', () => {
  it('summarises recent notes oldest-first with a header', () => {
    const notes = [note('a', 1, 'First thing'), note('b', 2, 'Second thing'), note('c', 3, 'Third thing')];
    expect(generateRecap(notes)).toBe('Previously on…\n• First thing\n• Second thing\n• Third thing');
  });

  it('keeps only the most recent `limit` notes', () => {
    const notes = [note('a', 1, 'old'), note('b', 2, 'mid'), note('c', 3, 'new')];
    expect(generateRecap(notes, 2)).toBe('Previously on…\n• mid\n• new');
  });

  it('uses only the first line and truncates long ones', () => {
    const long = 'x'.repeat(200);
    const out = generateRecap([note('a', 1, `${long}\nsecond line`)]);
    expect(out).toContain('…');
    expect(out).not.toContain('second line');
  });

  it('handles no notes', () => {
    expect(generateRecap([])).toBe('Previously on… nothing recorded yet.');
  });
});
