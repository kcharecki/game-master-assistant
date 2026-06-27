import { describe, it, expect } from 'vitest';
import { clampCols, gridAssetIds } from './grid';
import type { BroadcastPayload, GridCell } from '../lib/types';

describe('clampCols', () => {
  it('clamps to at least 1', () => {
    expect(clampCols(0)).toBe(1);
    expect(clampCols(-3)).toBe(1);
  });

  it('caps at 6 and at the cell count', () => {
    expect(clampCols(99)).toBe(6);
    expect(clampCols(4, 2)).toBe(2);
    expect(clampCols(3, 5)).toBe(3);
  });

  it('handles non-finite input', () => {
    expect(clampCols(NaN)).toBe(1);
    expect(clampCols(Infinity)).toBe(1);
  });
});

describe('gridAssetIds', () => {
  it('collects unique image asset ids, ignoring text and src cells', () => {
    const cells: GridCell[] = [
      { kind: 'image', assetId: 'a1' },
      { kind: 'text', title: 'Hi', body: 'there' },
      { kind: 'image', src: 'http://x/y.png' },
      { kind: 'image', assetId: 'a1' },
      { kind: 'image', assetId: 'a2' },
    ];
    expect(gridAssetIds(cells)).toEqual(['a1', 'a2']);
  });
});

describe('grid payload shape', () => {
  it('is assignable as a BroadcastPayload', () => {
    const payload: BroadcastPayload = {
      kind: 'grid',
      cols: 2,
      cells: [
        { kind: 'image', assetId: 'a1', caption: 'cell 1' },
        { kind: 'text', title: 'Clue', body: 'A torn page.' },
      ],
    };
    expect(payload.kind).toBe('grid');
    expect(payload.kind === 'grid' && payload.cells).toHaveLength(2);
  });
});
