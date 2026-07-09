import { describe, it, expect, beforeEach, vi } from 'vitest';

const kvGet = vi.fn().mockResolvedValue(undefined);
const kvSet = vi.fn().mockResolvedValue(undefined);
vi.mock('../db', () => ({ kvGet: (k: string) => kvGet(k), kvSet: (k: string, v: unknown) => kvSet(k, v) }));

import { SessionStore, DEFAULT_SESSION_TITLE } from './session.svelte';

describe('SessionStore', () => {
  let s: SessionStore;
  beforeEach(() => {
    kvGet.mockReset().mockResolvedValue(undefined);
    kvSet.mockReset().mockResolvedValue(undefined);
    s = new SessionStore();
  });

  it('defaults to the demo title', () => {
    expect(s.title).toBe(DEFAULT_SESSION_TITLE);
  });

  it('set updates state and persists to kv', () => {
    s.set('Curse of the Deep');
    expect(s.title).toBe('Curse of the Deep');
    expect(kvSet).toHaveBeenCalledWith('sessionTitle', 'Curse of the Deep');
  });

  it('load applies a saved string', async () => {
    kvGet.mockResolvedValueOnce('Masks of Nyarlathotep');
    await s.load();
    expect(s.title).toBe('Masks of Nyarlathotep');
  });

  it('load keeps the default when nothing is saved', async () => {
    kvGet.mockResolvedValueOnce(undefined);
    await s.load();
    expect(s.title).toBe(DEFAULT_SESSION_TITLE);
  });

  it('load ignores a non-string saved value', async () => {
    kvGet.mockResolvedValueOnce(42 as unknown as string);
    await s.load();
    expect(s.title).toBe(DEFAULT_SESSION_TITLE);
  });
});
