import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fake of the `assets` object store, keyed by id (keyPath: 'id').
const stores = new Map<string, Map<string, unknown>>();

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    async put(store: string, value: { id: string }) {
      if (!stores.has(store)) stores.set(store, new Map());
      stores.get(store)!.set(value.id, value);
    },
    async get(store: string, key: string) {
      return stores.get(store)?.get(key);
    },
  })),
}));

import { assetPut, assetGet, assetUrl } from './db';

describe('asset helpers', () => {
  beforeEach(() => {
    stores.clear();
    // Minimal object-URL shim for jsdom.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  });

  it('stores a blob and returns a fresh id', async () => {
    const id = await assetPut(new Blob(['x'], { type: 'image/png' }), 'image/png');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('round-trips the stored blob', async () => {
    const blob = new Blob(['hi'], { type: 'image/png' });
    const id = await assetPut(blob, 'image/png');
    expect(await assetGet(id)).toBe(blob);
  });

  it('returns undefined for a missing asset', async () => {
    expect(await assetGet('nope')).toBeUndefined();
    expect(await assetUrl('nope')).toBeUndefined();
  });

  it('wraps a present asset in an object URL', async () => {
    const id = await assetPut(new Blob(['x']), 'image/png');
    expect(await assetUrl(id)).toBe('blob:fake');
  });
});
