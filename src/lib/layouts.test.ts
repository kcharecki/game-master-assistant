import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('./db', () => ({
  kvGet: vi.fn(async (k: string) => store.get(k)),
  kvSet: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
}));

import {
  serializeLayout,
  upsertPreset,
  findPreset,
  removePreset,
  loadPresets,
  savePresets,
  type LayoutPreset,
} from './layouts';
import type { WindowState } from './types';

const win = (kind: string, x: number, y: number): WindowState => ({
  id: crypto.randomUUID(),
  kind: kind as WindowState['kind'],
  title: kind,
  x,
  y,
  w: 300,
  h: 200,
  z: 12,
  minimized: false,
  collapsed: false,
});

describe('serializeLayout', () => {
  it('keeps geometry, drops id/z/minimized', () => {
    const preset = serializeLayout('Combat', [win('initiative', 10, 20), win('roller', 30, 40)]);
    expect(preset.name).toBe('Combat');
    expect(preset.windows).toEqual([
      { kind: 'initiative', x: 10, y: 20, w: 300, h: 200 },
      { kind: 'roller', x: 30, y: 40, w: 300, h: 200 },
    ]);
  });
});

describe('upsert/find/remove', () => {
  const a: LayoutPreset = { name: 'Combat', windows: [] };
  const b: LayoutPreset = { name: 'Investigation', windows: [] };

  it('upsert appends new and replaces by case-insensitive name', () => {
    let presets = upsertPreset([a], b);
    expect(presets.map((p) => p.name)).toEqual(['Combat', 'Investigation']);
    const a2: LayoutPreset = { name: 'combat', windows: [{ kind: 'npcs', x: 1, y: 1, w: 2, h: 2 }] };
    presets = upsertPreset(presets, a2);
    expect(presets).toHaveLength(2);
    expect(findPreset(presets, 'COMBAT')?.windows).toHaveLength(1);
  });

  it('removePreset drops by name', () => {
    expect(removePreset([a, b], 'combat').map((p) => p.name)).toEqual(['Investigation']);
  });
});

describe('persistence', () => {
  beforeEach(() => store.clear());

  it('save then load round-trips per system', async () => {
    expect(await loadPresets('dnd5e')).toEqual([]);
    const presets: LayoutPreset[] = [{ name: 'X', windows: [] }];
    await savePresets('dnd5e', presets);
    expect(await loadPresets('dnd5e')).toEqual(presets);
    // keyed per system — coc7e is independent
    expect(await loadPresets('coc7e')).toEqual([]);
  });
});
