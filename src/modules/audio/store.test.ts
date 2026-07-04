import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory kv backing the mocked db so persist()/load() can round-trip.
const kv = new Map<string, unknown>();
const deleted: string[] = [];
vi.mock('../../lib/db', () => ({
  assetPut: vi.fn(async () => 'asset-1'),
  assetDelete: vi.fn(async (id: string) => void deleted.push(id)),
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
    audio.scenes = [
      { id: 'tavern', name: 'Tavern', tracks: [] },
      { id: 'dungeon', name: 'Dungeon', tracks: [] },
      { id: 'boss', name: 'Boss Fight', tracks: [] },
    ];
    audio.sfx = [];
  });

  it('persists a YouTube track and reloads it', async () => {
    audio.addYouTube('tavern', 'https://youtu.be/dQw4w9WgXcQ', 'Tavern loop');
    expect(audio.scenes[0].tracks).toHaveLength(1);

    // Simulate a refresh: wipe in-memory state, then load from the kv snapshot.
    audio.scenes = [{ id: 'tavern', name: 'Tavern', tracks: [] }];
    await audio.load();

    const track = audio.scenes.find((p) => p.id === 'tavern')?.tracks[0];
    expect(track?.youtubeId).toBe('dQw4w9WgXcQ');
    expect(track?.label).toBe('Tavern loop');
  });

  it('does not resurrect seed scenes after all are deleted', async () => {
    audio.removeScene('tavern');
    audio.removeScene('dungeon');
    audio.removeScene('boss');
    expect(audio.scenes).toHaveLength(0);

    // Simulate a refresh with a non-empty in-memory seed, then load.
    audio.scenes = [{ id: 'tavern', name: 'Tavern', tracks: [] }];
    await audio.load();
    expect(audio.scenes).toHaveLength(0);
  });

  it('migrates a legacy `playlists`/`scene` snapshot on load', async () => {
    // Write an old-format snapshot straight into the mocked kv.
    kv.set('audio', {
      playlists: [{ id: 'old', scene: 'Old Tavern', tracks: [] }],
    });
    audio.scenes = [{ id: 'seed', name: 'Seed', tracks: [] }];
    await audio.load();
    expect(audio.scenes).toHaveLength(1);
    expect(audio.scenes[0].id).toBe('old');
    expect(audio.scenes[0].name).toBe('Old Tavern');
  });

  it('shuffleScene keeps the same track set', () => {
    audio.scenes[0].tracks = [
      { id: 'a', assetId: 'a', label: 'A', gain: 1 },
      { id: 'b', assetId: 'b', label: 'B', gain: 1 },
      { id: 'c', assetId: 'c', label: 'C', gain: 1 },
    ];
    audio.shuffleScene('tavern');
    expect(
      audio.scenes[0].tracks
        .map((t) => t.id)
        .sort()
    ).toEqual(['a', 'b', 'c']);
  });

  it('setSceneGain clamps and persists', () => {
    audio.setSceneGain('tavern', 2);
    expect(audio.scenes.find((p) => p.id === 'tavern')?.gain).toBe(1);
    audio.setSceneGain('tavern', -1);
    expect(audio.scenes.find((p) => p.id === 'tavern')?.gain).toBe(0);
  });

  it('setRepeat maps modes to the two wire booleans', () => {
    audio.setRepeat('off');
    expect([audio.loopList, audio.loopTrack]).toEqual([false, false]);
    expect(audio.repeat).toBe('off');
    audio.setRepeat('scene');
    expect([audio.loopList, audio.loopTrack]).toEqual([true, false]);
    expect(audio.repeat).toBe('scene');
    audio.setRepeat('track');
    expect(audio.loopTrack).toBe(true);
    expect(audio.repeat).toBe('track');
  });

  it('removeTrack deletes the backing asset blob', () => {
    deleted.length = 0;
    audio.scenes[0].tracks = [{ id: 'x', assetId: 'blob-x', label: 'X', gain: 1 }];
    audio.removeTrack('tavern', 'x');
    expect(deleted).toContain('blob-x');
  });

  it('togglePin flips pinned and pinnedSfx reflects board order', () => {
    audio.sfx = [
      { id: 's1', assetId: 'a', label: 'One' },
      { id: 's2', assetId: 'b', label: 'Two' },
      { id: 's3', assetId: 'c', label: 'Three' },
    ];
    audio.togglePin('s3');
    audio.togglePin('s1');
    expect(audio.pinnedSfx.map((s) => s.id)).toEqual(['s1', 's3']);
    audio.togglePin('s1');
    expect(audio.pinnedSfx.map((s) => s.id)).toEqual(['s3']);
  });
});
