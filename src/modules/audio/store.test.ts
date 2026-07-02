import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory kv backing the mocked db so persist()/load() can round-trip.
const kv = new Map<string, unknown>();
vi.mock('../../lib/db', () => ({
  assetPut: vi.fn(async () => 'asset-1'),
  kvSet: vi.fn(async (key: string, value: unknown) => void kv.set(key, value)),
  kvGet: vi.fn(async (key: string) => kv.get(key)),
}));
// createBus is only used by play paths, not the add/persist paths under test.
vi.mock('../../lib/bus', () => ({
  createBus: () => ({ send: vi.fn(), on: () => () => {}, close: vi.fn() }),
}));

import { audio } from './store.svelte';

describe('audio store persistence', () => {
  beforeEach(() => {
    kv.clear();
    audio.playlists = [
      { id: 'tavern', scene: 'Tavern', tracks: [] },
      { id: 'dungeon', scene: 'Dungeon', tracks: [] },
      { id: 'boss', scene: 'Boss Fight', tracks: [] },
    ];
    audio.sfx = [];
  });

  it('persists a YouTube track and reloads it', async () => {
    audio.addYouTube('tavern', 'https://youtu.be/dQw4w9WgXcQ', 'Tavern loop');
    expect(audio.playlists[0].tracks).toHaveLength(1);

    // Simulate a refresh: wipe in-memory state, then load from the kv snapshot.
    audio.playlists = [{ id: 'tavern', scene: 'Tavern', tracks: [] }];
    await audio.load();

    const track = audio.playlists.find((p) => p.id === 'tavern')?.tracks[0];
    expect(track?.youtubeId).toBe('dQw4w9WgXcQ');
    expect(track?.label).toBe('Tavern loop');
  });

  it('does not resurrect seed playlists after all are deleted', async () => {
    audio.removePlaylist('tavern');
    audio.removePlaylist('dungeon');
    audio.removePlaylist('boss');
    expect(audio.playlists).toHaveLength(0);

    // Simulate a refresh with a non-empty in-memory seed, then load.
    audio.playlists = [{ id: 'tavern', scene: 'Tavern', tracks: [] }];
    await audio.load();
    expect(audio.playlists).toHaveLength(0);
  });
});
