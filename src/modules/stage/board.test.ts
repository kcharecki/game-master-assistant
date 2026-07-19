import { describe, it, expect } from 'vitest';
import {
  newBeat,
  clampTile,
  firstFree,
  makeTile,
  tileToCell,
  resolveTiles,
  templateFromBeat,
  beatFromTemplate,
  distributeAreas,
  formatCountdown,
  STAGE_COLS,
  STAGE_ROWS,
  type Beat,
  type Tile,
} from './board';
import type { PublicNpc } from '../npcs/public';

const noNpc = (): PublicNpc | undefined => undefined;

function beatWith(tiles: Partial<Tile>[]): Beat {
  const b = newBeat('S');
  b.tiles = tiles.map((t, i) => ({
    id: `t${i}`,
    kind: 'text',
    col: 1,
    row: 1,
    cw: 6,
    rh: 2,
    ...t,
  }));
  return b;
}

describe('clampTile', () => {
  it('keeps a tile inside the grid', () => {
    const t = clampTile(
      { id: 'a', kind: 'image', col: 20, row: 20, cw: 99, rh: 99 },
      STAGE_COLS,
      STAGE_ROWS,
    );
    expect(t.col).toBeGreaterThanOrEqual(1);
    expect(t.col + t.cw - 1).toBeLessThanOrEqual(STAGE_COLS);
    expect(t.row + t.rh - 1).toBeLessThanOrEqual(STAGE_ROWS);
  });

  it('enforces a minimum span of 1', () => {
    const t = clampTile({ id: 'a', kind: 'text', col: 1, row: 1, cw: 0, rh: 0 }, 12, 8);
    expect(t.cw).toBe(1);
    expect(t.rh).toBe(1);
  });
});

describe('firstFree / makeTile', () => {
  it('returns 1,1 on an empty scene', () => {
    expect(firstFree(newBeat('e'), 6, 4)).toEqual({ col: 1, row: 1 });
  });

  it('skips an occupied region', () => {
    const s = beatWith([{ col: 1, row: 1, cw: 6, rh: 8 }]);
    const spot = firstFree(s, 6, 4);
    expect(spot.col).toBe(7); // right half is the first free fit
  });

  it('makeTile places a non-overlapping tile', () => {
    const s = beatWith([{ col: 1, row: 1, cw: 6, rh: 4 }]);
    const t = makeTile('image', s);
    expect(t.col === 7 || t.row > 1).toBe(true);
  });
});

describe('tileToCell', () => {
  it('drops hidden tiles', () => {
    expect(
      tileToCell(
        { id: 'a', kind: 'text', col: 1, row: 1, cw: 2, rh: 2, hidden: true, body: 'x' },
        noNpc,
      ),
    ).toBeNull();
  });

  it('drops empty content', () => {
    expect(tileToCell({ id: 'a', kind: 'text', col: 1, row: 1, cw: 2, rh: 2 }, noNpc)).toBeNull();
    expect(tileToCell({ id: 'b', kind: 'image', col: 1, row: 1, cw: 2, rh: 2 }, noNpc)).toBeNull();
  });

  it('carries placement as area', () => {
    const cell = tileToCell(
      { id: 'a', kind: 'text', col: 3, row: 2, cw: 4, rh: 2, title: 'Hi' },
      noNpc,
    );
    expect(cell).toEqual({ kind: 'text', title: 'Hi', area: { col: 3, row: 2, cw: 4, rh: 2 } });
  });

  it('projects an NPC with a portrait to an image cell', () => {
    const lookup = (): PublicNpc => ({ name: 'Bob', role: 'Guard', portraitId: 'p1', blurb: '' });
    const cell = tileToCell(
      { id: 'a', kind: 'npc', col: 1, row: 1, cw: 4, rh: 4, npcId: 'n' },
      lookup,
    );
    expect(cell).toMatchObject({ kind: 'image', assetId: 'p1', caption: 'Bob — Guard' });
  });

  it('keeps gm-only npc fields out (uses public projection only)', () => {
    const lookup = (): PublicNpc => ({
      name: 'Bob',
      role: '',
      portraitId: undefined,
      blurb: 'seen at docks',
    });
    const cell = tileToCell(
      { id: 'a', kind: 'npc', col: 1, row: 1, cw: 4, rh: 4, npcId: 'n' },
      lookup,
    );
    expect(cell).toMatchObject({ kind: 'text', title: 'Bob', body: 'seen at docks' });
  });
});

describe('tileToCell — new kinds + z', () => {
  it('carries an explicit z onto the cell', () => {
    const cell = tileToCell(
      { id: 'a', kind: 'text', col: 1, row: 1, cw: 2, rh: 2, title: 'Hi', z: 5 },
      noNpc,
    );
    expect(cell).toMatchObject({ kind: 'text', z: 5 });
  });

  it('carries image reveal + text theme through', () => {
    expect(
      tileToCell(
        { id: 'a', kind: 'image', col: 1, row: 1, cw: 2, rh: 2, src: 'x', reveal: 'blur' },
        noNpc,
      ),
    ).toMatchObject({ kind: 'image', reveal: 'blur' });
    expect(
      tileToCell(
        { id: 'b', kind: 'text', col: 1, row: 1, cw: 2, rh: 2, body: 'y', theme: 'parchment' },
        noNpc,
      ),
    ).toMatchObject({ kind: 'text', theme: 'parchment' });
  });

  it('projects a clock tile (default 60s) with its label', () => {
    const cell = tileToCell(
      { id: 'a', kind: 'clock', col: 1, row: 1, cw: 4, rh: 2, seconds: 90, title: 'Doom' },
      noNpc,
    );
    expect(cell).toMatchObject({ kind: 'clock', seconds: 90, label: 'Doom' });
  });

  it('drops a date tile without a date, keeps one with', () => {
    expect(
      tileToCell({ id: 'a', kind: 'date', col: 1, row: 1, cw: 4, rh: 2 }, noNpc),
    ).toBeNull();
    expect(
      tileToCell(
        { id: 'b', kind: 'date', col: 1, row: 1, cw: 4, rh: 2, date: '12 Mirtul', moon: 'Full Moon' },
        noNpc,
      ),
    ).toMatchObject({ kind: 'date', date: '12 Mirtul', moon: 'Full Moon' });
  });

  it('carries the Timeline time onto a date cell when present', () => {
    expect(
      tileToCell(
        { id: 'c', kind: 'date', col: 1, row: 1, cw: 4, rh: 2, date: '12 Mirtul', time: '14:05' },
        noNpc,
      ),
    ).toMatchObject({ kind: 'date', date: '12 Mirtul', time: '14:05' });
  });
});

describe('formatCountdown', () => {
  it('formats sub-hour as m:ss', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(5)).toBe('0:05');
  });
  it('formats past an hour as h:mm:ss', () => {
    expect(formatCountdown(3661)).toBe('1:01:01');
  });
  it('clamps negatives to zero', () => {
    expect(formatCountdown(-10)).toBe('0:00');
  });
});

describe('templates', () => {
  it('round-trips layout without content', () => {
    const s = beatWith([{ col: 2, row: 3, cw: 4, rh: 2, kind: 'image', src: 'x' }]);
    const tpl = templateFromBeat(s, 'P');
    expect(tpl.slots[0]).toEqual({ kind: 'image', col: 2, row: 3, cw: 4, rh: 2 });
    const beat2 = beatFromTemplate(tpl, 'New');
    expect(beat2.tiles[0]).toMatchObject({ kind: 'image', col: 2, row: 3, cw: 4, rh: 2 });
    expect(beat2.tiles[0].src).toBeUndefined(); // content stripped
    expect(beat2.id).not.toBe(s.id);
    expect(beat2.templateId).toBe(tpl.id); // beat remembers its origin template
  });
});

describe('resolveTiles (variant deltas)', () => {
  it('returns base tiles with no variant', () => {
    const b = beatWith([{ id: 'x', title: 'Base' }]);
    expect(resolveTiles(b)).toBe(b.tiles);
    expect(resolveTiles(b, 'nope')).toBe(b.tiles); // unknown id → base
  });

  it('applies patches, removals, and additions', () => {
    const b = beatWith([
      { id: 'keep', title: 'Keep' },
      { id: 'gone', title: 'Gone' },
    ]);
    b.variants = [
      {
        id: 'v1',
        name: 'Night',
        patches: { keep: { title: 'Patched' } },
        removed: ['gone'],
        added: [{ id: 'new', kind: 'text', col: 1, row: 1, cw: 2, rh: 2, title: 'Added' }],
      },
    ];
    const tiles = resolveTiles(b, 'v1');
    expect(tiles.map((t) => t.title)).toEqual(['Patched', 'Added']);
  });
});

describe('distributeAreas', () => {
  it('returns nothing for an empty board', () => {
    expect(distributeAreas(0, 12, 8)).toEqual([]);
  });

  it('gives one tile the whole board', () => {
    expect(distributeAreas(1, 12, 8)).toEqual([{ col: 1, row: 1, cw: 12, rh: 8 }]);
  });

  it('splits four tiles into equal quadrants', () => {
    expect(distributeAreas(4, 12, 8)).toEqual([
      { col: 1, row: 1, cw: 6, rh: 4 },
      { col: 7, row: 1, cw: 6, rh: 4 },
      { col: 1, row: 5, cw: 6, rh: 4 },
      { col: 7, row: 5, cw: 6, rh: 4 },
    ]);
  });

  it('fills the board with no gaps or overlaps for any count', () => {
    for (let n = 1; n <= 20; n++) {
      const cells = new Set<string>();
      for (const a of distributeAreas(n, 12, 8)) {
        expect(a.cw).toBeGreaterThanOrEqual(1);
        expect(a.rh).toBeGreaterThanOrEqual(1);
        expect(a.col + a.cw - 1).toBeLessThanOrEqual(12);
        expect(a.row + a.rh - 1).toBeLessThanOrEqual(8);
        for (let c = a.col; c < a.col + a.cw; c++)
          for (let r = a.row; r < a.row + a.rh; r++) {
            const key = `${c},${r}`;
            expect(cells.has(key)).toBe(false); // no overlap
            cells.add(key);
          }
      }
      expect(cells.size).toBe(12 * 8); // fills the board completely
    }
  });
});
