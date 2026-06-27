import { describe, it, expect } from 'vitest';
import { publicView } from './public';
import type { Npc } from './store.svelte';

const fullNpc: Npc = {
  id: 'x',
  name: 'Zadok Allen',
  role: 'Town Drunk',
  disposition: 'neutral',
  voice: 'slurred',
  portraitId: 'asset-1',
  gallery: ['asset-1', 'asset-2'],
  equipment: [{ id: 'e1', name: 'Hidden flask', qty: 1, notes: 'laced' }],
  gmNotes: 'Secretly a cultist informant.',
  publicBlurb: 'A weathered old man muttering by the docks.',
  stats: [{ id: 's1', key: 'HP', val: '6' }],
};

describe('publicView', () => {
  it('keeps only player-safe fields', () => {
    const v = publicView(fullNpc);
    expect(v).toEqual({
      name: 'Zadok Allen',
      role: 'Town Drunk',
      portraitId: 'asset-1',
      blurb: 'A weathered old man muttering by the docks.',
      stats: [{ id: 's1', key: 'HP', val: '6' }],
    });
  });

  it('strips gmNotes (private)', () => {
    const v = publicView(fullNpc) as unknown as Record<string, unknown>;
    expect('gmNotes' in v).toBe(false);
    expect(JSON.stringify(v)).not.toContain('cultist informant');
  });

  it('strips equipment (GM-only by default)', () => {
    const v = publicView(fullNpc) as unknown as Record<string, unknown>;
    expect('equipment' in v).toBe(false);
    expect(JSON.stringify(v)).not.toContain('Hidden flask');
  });

  it('does not leak voice, gallery, or disposition', () => {
    const v = publicView(fullNpc) as unknown as Record<string, unknown>;
    expect('voice' in v).toBe(false);
    expect('gallery' in v).toBe(false);
    expect('disposition' in v).toBe(false);
  });

  it('omits optional fields when absent', () => {
    const bare: Npc = { id: 'y', name: 'Guard', role: '', disposition: 'neutral' };
    const v = publicView(bare);
    expect(v).toEqual({ name: 'Guard', role: '' });
  });

  it('clones stats so callers cannot mutate the source', () => {
    const v = publicView(fullNpc);
    v.stats![0].val = '999';
    expect(fullNpc.stats![0].val).toBe('6');
  });
});
