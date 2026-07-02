import { describe, it, expect, vi } from 'vitest';

// Mock db() with an in-memory fake of the idb surface we use.
const stores: Record<string, Map<unknown, unknown>> = {
  kv: new Map(),
  npcs: new Map(),
  scenes: new Map(),
  handouts: new Map(),
  notes: new Map(),
  assets: new Map(),
};
const fakeDb = {
  async getAllKeys(s: string) {
    return [...stores[s].keys()];
  },
  async getAll(s: string) {
    return [...stores[s].values()];
  },
  async get(s: string, k: unknown) {
    return stores[s].get(k);
  },
  async put(s: string, v: unknown, k?: unknown) {
    // kv uses (value, key); keyPath stores use (value) with v.id as key
    const key = k ?? (v as { id: unknown }).id;
    stores[s].set(key, v);
  },
};
vi.mock('./db', () => ({ db: async () => fakeDb }));

import {
  bytesToBase64,
  base64ToBytes,
  buildCampaign,
  parseCampaign,
  quotaInfo,
  campaignToJson,
  exportCampaign,
  importCampaign,
  CAMPAIGN_VERSION,
  buildSnapshot,
  pushSnapshot,
  mergeSnapshot,
  makeSnapshot,
  restoreSnapshot,
  listSnapshots,
  SNAPSHOTS_KEY,
  MAX_SNAPSHOTS,
  type Snapshot,
} from './backup';

describe('base64 round-trip', () => {
  it('encodes and decodes bytes losslessly', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});

describe('parseCampaign', () => {
  it('accepts a well-formed file', () => {
    const f = buildCampaign({ a: 1 }, { notes: [] }, []);
    expect(parseCampaign(f).version).toBe(CAMPAIGN_VERSION);
  });
  it('rejects bad input', () => {
    expect(() => parseCampaign(null)).toThrow();
    expect(() => parseCampaign({ version: 99 })).toThrow();
    expect(() => parseCampaign({ version: 1, kv: {}, stores: {} })).toThrow(); // no assets
  });
});

describe('quotaInfo', () => {
  it('computes ratio and nearLimit', () => {
    expect(quotaInfo(50, 100).ratio).toBe(0.5);
    expect(quotaInfo(50, 100).nearLimit).toBe(false);
    expect(quotaInfo(95, 100).nearLimit).toBe(true);
    expect(quotaInfo(10, 0)).toEqual({ usage: 10, quota: 0, ratio: 0, nearLimit: false });
  });
});

describe('export/import round-trip', () => {
  it('dumps and restores kv, stores, and assets', async () => {
    stores.kv.set('system', 'dnd5e');
    stores.notes.set('n1', { id: 'n1', body: 'hi', at: 1 });
    stores.assets.set('a1', { id: 'a1', type: 'image/png', blob: new Blob([new Uint8Array([7, 8, 9])], { type: 'image/png' }) });

    const file = await exportCampaign();
    expect(file.kv.system).toBe('dnd5e');
    expect(file.stores.notes).toHaveLength(1);
    expect(file.assets[0].id).toBe('a1');
    expect(typeof file.assets[0].data).toBe('string');

    // wipe, then import back
    for (const m of Object.values(stores)) m.clear();
    await importCampaign(file);
    expect(stores.kv.get('system')).toBe('dnd5e');
    expect(stores.notes.get('n1')).toMatchObject({ body: 'hi' });
    const restored = stores.assets.get('a1') as { blob: Blob };
    expect([...new Uint8Array(await restored.blob.arrayBuffer())]).toEqual([7, 8, 9]);
  });
});

describe('campaignToJson', () => {
  it('produces parseable JSON', () => {
    const f = buildCampaign({}, {}, []);
    expect(parseCampaign(JSON.parse(campaignToJson(f)))).toEqual(f);
  });
});

describe('snapshot pure helpers', () => {
  it('buildSnapshot stamps id/label from time', () => {
    const s = buildSnapshot({ a: 1 }, { notes: [] }, 1000);
    expect(s.id).toBe('snap-1000');
    expect(s.at).toBe(1000);
    expect(s.label).toBe(new Date(1000).toISOString());
    expect(s.kv.a).toBe(1);
  });

  it('pushSnapshot keeps newest-first and caps length', () => {
    let ring: Snapshot[] = [];
    for (let i = 1; i <= MAX_SNAPSHOTS + 2; i++) {
      ring = pushSnapshot(ring, buildSnapshot({}, {}, i));
    }
    expect(ring).toHaveLength(MAX_SNAPSHOTS);
    expect(ring[0].at).toBe(MAX_SNAPSHOTS + 2); // newest first
  });

  it('mergeSnapshot lets snapshot rows win but keeps live-only rows', () => {
    const live = {
      kv: { system: 'coc', extra: 1 },
      stores: { notes: [{ id: 'a', body: 'live-a' }, { id: 'b', body: 'live-b' }] },
    };
    const snap = buildSnapshot(
      { system: 'dnd5e' },
      { notes: [{ id: 'a', body: 'snap-a' }] },
      5
    );
    const merged = mergeSnapshot(live, snap);
    expect(merged.kv).toEqual({ system: 'dnd5e', extra: 1 });
    const notes = merged.stores.notes as { id: string; body: string }[];
    expect(notes.find((n) => n.id === 'a')?.body).toBe('snap-a');
    expect(notes.find((n) => n.id === 'b')?.body).toBe('live-b');
  });
});

describe('snapshot IndexedDB round-trip', () => {
  it('captures a snapshot, lists it, and restores it', async () => {
    for (const m of Object.values(stores)) m.clear();
    stores.kv.set('system', 'coc');
    stores.notes.set('n1', { id: 'n1', body: 'original', at: 1 });

    const snap = await makeSnapshot('my session');
    expect(snap.label).toBe('my session');
    expect((stores.kv.get(SNAPSHOTS_KEY) as Snapshot[]).length).toBe(1);
    // the snapshot ring key must not be captured inside the snapshot
    expect(SNAPSHOTS_KEY in snap.kv).toBe(false);

    const list = await listSnapshots();
    expect(list[0].id).toBe(snap.id);

    // mutate live data, then roll back
    stores.notes.set('n1', { id: 'n1', body: 'changed', at: 2 });
    const ok = await restoreSnapshot(snap.id);
    expect(ok).toBe(true);
    expect((stores.notes.get('n1') as { body: string }).body).toBe('original');
    expect(await restoreSnapshot('missing')).toBe(false);
  });
});
