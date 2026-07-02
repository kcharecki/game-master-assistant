import { describe, it, expect } from 'vitest';
import {
  newScene,
  clampTile,
  firstFree,
  makeTile,
  tileToCell,
  sceneToPayload,
  presetFromScene,
  sceneFromPreset,
  snapZones,
  zoneAt,
  formatCountdown,
  STAGE_COLS,
  STAGE_ROWS,
  type Scene,
  type Tile,
} from './board';
import type { PublicNpc } from '../npcs/public';

const noNpc = (): PublicNpc | undefined => undefined;

function sceneWith(tiles: Partial<Tile>[]): Scene {
  const s = newScene('S');
  s.tiles = tiles.map((t, i) => ({
    id: `t${i}`,
    kind: 'text',
    col: 1,
    row: 1,
    cw: 6,
    rh: 2,
    ...t,
  }));
  return s;
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
    expect(firstFree(newScene('e'), 6, 4)).toEqual({ col: 1, row: 1 });
  });

  it('skips an occupied region', () => {
    const s = sceneWith([{ col: 1, row: 1, cw: 6, rh: 8 }]);
    const spot = firstFree(s, 6, 4);
    expect(spot.col).toBe(7); // right half is the first free fit
  });

  it('makeTile places a non-overlapping tile', () => {
    const s = sceneWith([{ col: 1, row: 1, cw: 6, rh: 4 }]);
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

  it('drops a roll tile without a result, keeps one with', () => {
    expect(
      tileToCell({ id: 'a', kind: 'roll', col: 1, row: 1, cw: 4, rh: 3 }, noNpc),
    ).toBeNull();
    const cell = tileToCell(
      {
        id: 'b',
        kind: 'roll',
        col: 1,
        row: 1,
        cw: 4,
        rh: 3,
        roll: { expr: '1d20', total: 17, kept: [17], modifier: 0 },
      },
      noNpc,
    );
    expect(cell).toMatchObject({ kind: 'roll', expr: '1d20', total: 17, kept: [17] });
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

describe('sceneToPayload', () => {
  it('is null when nothing visible resolves', () => {
    expect(sceneToPayload(newScene('e'), noNpc)).toBeNull();
  });

  it('emits a placed grid payload', () => {
    const s = sceneWith([{ col: 1, row: 1, cw: 6, rh: 4, kind: 'text', title: 'A' }]);
    const p = sceneToPayload(s, noNpc)!;
    expect(p.kind).toBe('grid');
    expect(p.cols).toBe(STAGE_COLS);
    expect(p.rows).toBe(STAGE_ROWS);
    expect(p.cells[0].area).toEqual({ col: 1, row: 1, cw: 6, rh: 4 });
  });
});

describe('presets', () => {
  it('round-trips layout without content', () => {
    const s = sceneWith([{ col: 2, row: 3, cw: 4, rh: 2, kind: 'image', src: 'x' }]);
    const preset = presetFromScene(s, 'P');
    expect(preset.slots[0]).toEqual({ kind: 'image', col: 2, row: 3, cw: 4, rh: 2 });
    const scene2 = sceneFromPreset(preset, 'New');
    expect(scene2.tiles[0]).toMatchObject({ kind: 'image', col: 2, row: 3, cw: 4, rh: 2 });
    expect(scene2.tiles[0].src).toBeUndefined(); // content stripped
    expect(scene2.id).not.toBe(s.id);
  });
});

describe('snapZones', () => {
  it('produces in-bounds areas', () => {
    for (const z of snapZones(12, 8)) {
      expect(z.area.col).toBeGreaterThanOrEqual(1);
      expect(z.area.col + z.area.cw - 1).toBeLessThanOrEqual(12);
      expect(z.area.row + z.area.rh - 1).toBeLessThanOrEqual(8);
    }
  });

  it('includes a full-stage zone', () => {
    expect(snapZones(12, 8).find((z) => z.id === 'full')!.area).toEqual({
      col: 1,
      row: 1,
      cw: 12,
      rh: 8,
    });
  });
});

describe('zoneAt', () => {
  it('returns null in the centre (free placement)', () => {
    expect(zoneAt(0.5, 0.5, 12, 8)).toBeNull();
  });
  it('snaps left half on the left edge', () => {
    expect(zoneAt(0.05, 0.5, 12, 8)).toEqual({ col: 1, row: 1, cw: 6, rh: 8 });
  });
  it('snaps a corner quadrant', () => {
    expect(zoneAt(0.95, 0.05, 12, 8)).toEqual({ col: 7, row: 1, cw: 6, rh: 4 });
  });
});
