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
