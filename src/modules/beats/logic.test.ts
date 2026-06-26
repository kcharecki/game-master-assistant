import { describe, it, expect } from 'vitest';
import { ordered, move, add, remove, type Beat } from './logic';

const beats: Beat[] = [
  { id: 'a', title: 'Hook', order: 0 },
  { id: 'b', title: 'Rising', order: 1 },
  { id: 'c', title: 'Climax', order: 2 },
];

const ids = (bs: Beat[]) => ordered(bs).map((b) => b.id);

describe('ordered', () => {
  it('sorts by order field', () => {
    expect(ids([beats[2], beats[0], beats[1]])).toEqual(['a', 'b', 'c']);
  });
});

describe('move', () => {
  it('moves a beat down', () => {
    expect(ids(move(beats, 'a', 1))).toEqual(['b', 'a', 'c']);
  });
  it('moves a beat up', () => {
    expect(ids(move(beats, 'c', -1))).toEqual(['a', 'c', 'b']);
  });
  it('is a no-op at the start boundary', () => {
    expect(ids(move(beats, 'a', -1))).toEqual(['a', 'b', 'c']);
  });
  it('is a no-op at the end boundary', () => {
    expect(ids(move(beats, 'c', 1))).toEqual(['a', 'b', 'c']);
  });
  it('re-packs order gap-free', () => {
    expect(move(beats, 'a', 1).map((b) => b.order).sort()).toEqual([0, 1, 2]);
  });
});

describe('add / remove', () => {
  it('appends with the next order', () => {
    const next = add(beats, 'Denouement');
    expect(next).toHaveLength(4);
    expect(ordered(next)[3]).toMatchObject({ title: 'Denouement', order: 3 });
  });
  it('removes and re-packs', () => {
    const next = remove(beats, 'b');
    expect(ids(next)).toEqual(['a', 'c']);
    expect(next.map((b) => b.order)).toEqual([0, 1]);
  });
});
