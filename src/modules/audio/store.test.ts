import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory kv backing the mocked db so persist()/load() can round-trip.
const kv = new Map<string, unknown>();
const deleted: string[] = [];
// Controllable assetUrl(): each call pushes its resolver instead of resolving
// immediately, so tests can settle them in an arbitrary order to simulate a
// stale load (from a superseded audition/monitor) resolving after a newer one.
let assetUrlResolvers: Array<(url: string | undefined) => void> = [];
vi.mock('../../lib/db', () => ({
  assetPut: vi.fn(async () => 'asset-1'),
  assetDelete: vi.fn(async (id: string) => void deleted.push(id)),
  assetUrl: vi.fn(
    () =>
      new Promise<string | undefined>((resolve) => {
        assetUrlResolvers.push(resolve);
      })
  ),
  kvSet: vi.fn(async (key: string, value: unknown) => void kv.set(key, value)),
  kvGet: vi.fn(async (key: string) => kv.get(key)),
}));
// createBus is only used by play paths, not the add/persist paths under test.
vi.mock('../../lib/bus', () => ({
  createBus: () => ({ send: vi.fn(), on: () => () => {}, close: vi.fn() }),
}));

import { audio } from './store.svelte';

// jsdom's Audio.play() throws "not implemented" synchronously, and
// URL.revokeObjectURL isn't implemented at all — stub both so the
// monitor/audition async-race tests can run against a real (fake) element.
class FakeAudio {
  src: string;
  volume = 1;
  loop = false;
  paused = true;
  onended: (() => void) | null = null;
  constructor(src = '') {
    this.src = src;
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}
const revokeSpy = vi.fn();
vi.stubGlobal('Audio', FakeAudio);
(URL as unknown as { revokeObjectURL: typeof revokeSpy }).revokeObjectURL = revokeSpy;

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

describe('GM monitor + audition async races', () => {
  beforeEach(() => {
    // Tear down whatever the previous test left playing *before* clearing the
    // spy/resolver queue below, so cleanup-triggered revokes (e.g. of a
    // still-installed monitor blob) don't leak into this test's assertions.
    audio.stopAudition();
    audio.setMonitor(false);
    assetUrlResolvers = [];
    revokeSpy.mockClear();
    audio.scenes = [
      {
        id: 'tavern',
        name: 'Tavern',
        tracks: [
          { id: 't1', assetId: 'a1', label: 'One', gain: 1 },
          { id: 't2', assetId: 'a2', label: 'Two', gain: 1 },
        ],
      },
    ];
    audio.playingScene = null;
    audio.paused = false;
    audio.trackIndex = 0;
  });

  it('ignores a stale syncMonitor() resolve once the track has moved on, and revokes its blob', async () => {
    audio.monitor = true;
    audio.playingScene = 'tavern';
    audio.trackIndex = 0;

    audio.syncMonitor(); // in-flight load for track 1 (a1)
    expect(assetUrlResolvers).toHaveLength(1);

    // Track advances before the first load resolves — a second, newer load starts.
    audio.trackIndex = 1;
    audio.syncMonitor(); // in-flight load for track 2 (a2)
    expect(assetUrlResolvers).toHaveLength(2);

    // The stale (first) load resolves *after* the newer one has already started.
    assetUrlResolvers[0]('blob:stale');
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).toHaveBeenCalledWith('blob:stale');

    // The current load wins and is installed without being revoked.
    assetUrlResolvers[1]('blob:live');
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:live');
  });

  it('revokes the monitor blob on manual stop, not only on onended', async () => {
    audio.monitor = true;
    audio.playingScene = 'tavern';
    audio.trackIndex = 0;
    audio.syncMonitor();
    assetUrlResolvers[0]('blob:live');
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:live');

    audio.setMonitor(false); // manual stop, track never "ended"
    expect(revokeSpy).toHaveBeenCalledWith('blob:live');
  });

  it('audition() revokes the previous clip on stop/switch, not just onended', async () => {
    audio.audition('sfx-1');
    assetUrlResolvers[0]('blob:one');
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:one');

    audio.audition('sfx-2'); // switches away from the first clip mid-play
    expect(revokeSpy).toHaveBeenCalledWith('blob:one');

    assetUrlResolvers[1]('blob:two');
    await Promise.resolve();
    await Promise.resolve();

    audio.stopAudition();
    expect(revokeSpy).toHaveBeenCalledWith('blob:two');
  });

  it('a stale audition() resolve after a fast switch does not clobber the newer clip', async () => {
    audio.audition('sfx-1');
    audio.audition('sfx-2'); // supersedes before the first load resolves

    assetUrlResolvers[0]('blob:one'); // stale resolve arrives late
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).toHaveBeenCalledWith('blob:one');

    assetUrlResolvers[1]('blob:two');
    await Promise.resolve();
    await Promise.resolve();
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:two');
  });
});
