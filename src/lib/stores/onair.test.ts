import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the bus so we can drive the live listener by hand, and kv so load()/clear()
// are pure. `vi.hoisted` lets the factories reference these shared handles.
const bus = vi.hoisted(() => ({
  handler: null as null | ((m: unknown) => void),
  send: vi.fn(),
  close: vi.fn(),
}));
const db = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock('../bus', () => ({
  createBus: () => ({
    on: (cb: (m: unknown) => void) => {
      bus.handler = cb;
      return () => {};
    },
    send: bus.send,
    close: bus.close,
  }),
}));
vi.mock('../db', () => ({ kvGet: db.get, kvSet: db.set }));

import { OnAirStore } from './onair.svelte';

beforeEach(() => {
  bus.handler = null;
  bus.send.mockClear();
  bus.close.mockClear();
  db.get.mockReset().mockResolvedValue(undefined);
  db.set.mockReset().mockResolvedValue(undefined);
});

describe('OnAirStore.load', () => {
  it('rehydrates from kv when no live push arrives', async () => {
    db.get.mockResolvedValue({ kind: 'image', assetId: 'a' });
    const s = new OnAirStore();
    await s.load();
    expect(s.payload).toEqual({ kind: 'image', assetId: 'a' });
  });

  it('a live push during rehydrate wins over the stale kv snapshot (race fix)', async () => {
    let resolveKv!: (v: unknown) => void;
    db.get.mockReturnValue(new Promise((r) => (resolveKv = r)));
    const s = new OnAirStore();
    const loading = s.load(); // wires bus, then awaits kvGet
    // GM pushes new content before the IndexedDB read resolves.
    bus.handler!({ type: 'broadcast', payload: { kind: 'text', body: 'LIVE' } });
    resolveKv({ kind: 'text', body: 'STALE' }); // late rehydrate must NOT clobber
    await loading;
    expect(s.payload).toEqual({ kind: 'text', body: 'LIVE' });
  });

  it('ignores transient ping/laser/audio pushes', async () => {
    db.get.mockResolvedValue({ kind: 'clear' });
    const s = new OnAirStore();
    await s.load();
    bus.handler!({ type: 'broadcast', payload: { kind: 'ping', x: 1, y: 2 } });
    bus.handler!({ type: 'broadcast', payload: { kind: 'laser', on: true, x: 0, y: 0 } });
    expect(s.payload).toEqual({ kind: 'clear' });
  });

  it('is idempotent — a second load() does nothing', async () => {
    db.get.mockResolvedValue({ kind: 'clear' });
    const s = new OnAirStore();
    await s.load();
    db.get.mockClear();
    await s.load();
    expect(db.get).not.toHaveBeenCalled();
  });
});

describe('OnAirStore.clear', () => {
  it('sends clear + audio panic, mirrors state, and persists', () => {
    const s = new OnAirStore();
    s.clear();
    expect(bus.send).toHaveBeenCalledWith({ kind: 'clear' });
    expect(bus.send).toHaveBeenCalledWith({ kind: 'audio', channel: 'ambient', action: 'panic' });
    expect(s.payload).toEqual({ kind: 'clear' });
    expect(db.set).toHaveBeenCalledWith('broadcastState', { kind: 'clear' });
  });
});
