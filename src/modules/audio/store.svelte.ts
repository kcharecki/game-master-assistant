import { assetPut, kvGet, kvSet } from '../../lib/db';
import { createBus } from '../../lib/bus';
import type { BroadcastPayload } from '../../lib/types';
import { parseYouTubeId, type Playlist, type Sfx, type Track } from './logic';

const SEED_PLAYLISTS: Playlist[] = [
  { id: 'tavern', scene: 'Tavern', tracks: [] },
  { id: 'dungeon', scene: 'Dungeon', tracks: [] },
  { id: 'boss', scene: 'Boss Fight', tracks: [] },
];

/** Send an audio cue to the broadcast tab's <audio> element. */
function sendAudio(payload: Extract<BroadcastPayload, { kind: 'audio' }>): void {
  const bus = createBus();
  bus.send(payload);
  bus.close();
}

/** Ambient playlists + one-shot SFX, routed to the broadcast tab. */
class AudioStore {
  playlists = $state<Playlist[]>([...SEED_PLAYLISTS]);
  sfx = $state<Sfx[]>([]);
  /** id of the playlist currently playing on air, if any */
  playingScene = $state<string | null>(null);
  /** true while the on-air ambient track is a YouTube embed (no native seek) */
  playingYouTube = $state(false);
  /** play YouTube tracks as sound only — hide the video on the broadcast tab */
  ytAudioOnly = $state(false);

  // Reactive ambient transport state, fed by the broadcast tab's audioStatus
  // reports over the reverse bus channel (see subscribeStatus).
  position = $state(0);
  duration = $state(0);
  playing = $state(false);

  /** Import an audio file into assets, returning its id. */
  private async importFile(file: File): Promise<string> {
    return assetPut(file, file.type || 'audio/mpeg');
  }

  async addTrack(playlistId: string, file: File): Promise<Track | undefined> {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const assetId = await this.importFile(file);
    const track: Track = { id: crypto.randomUUID(), assetId, label: file.name };
    pl.tracks.push(track);
    this.persist();
    return track;
  }

  /** Add a YouTube URL as an ambient track. Returns undefined if the url has no id. */
  addYouTube(playlistId: string, url: string, label?: string): Track | undefined {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const youtubeId = parseYouTubeId(url);
    if (!youtubeId) return;
    const track: Track = {
      id: crypto.randomUUID(),
      youtubeId,
      label: label?.trim() || `YouTube ${youtubeId}`,
    };
    pl.tracks.push(track);
    this.persist();
    return track;
  }

  async addSfx(file: File): Promise<Sfx> {
    const assetId = await this.importFile(file);
    const s: Sfx = { id: crypto.randomUUID(), assetId, label: file.name };
    this.sfx.push(s);
    this.persist();
    return s;
  }

  /**
   * Play the first track of a scene playlist as looping ambience.
   * Sends the asset id (not an object URL): the broadcast tab resolves the blob
   * from shared IndexedDB itself, because blob: URLs don't cross tab boundaries.
   */
  playScene(playlistId: string): void {
    const pl = this.playlists.find((p) => p.id === playlistId);
    const first = pl?.tracks[0];
    if (!first) return;
    if (first.youtubeId) {
      sendAudio({
        kind: 'audio',
        youtubeId: first.youtubeId,
        audioOnly: this.ytAudioOnly,
        loop: true,
        action: 'play',
        channel: 'ambient',
      });
      this.playingYouTube = true;
    } else if (first.assetId) {
      sendAudio({ kind: 'audio', assetId: first.assetId, loop: true, action: 'play', channel: 'ambient' });
      this.playingYouTube = false;
    } else {
      return;
    }
    this.playingScene = playlistId;
    this.position = 0;
    this.duration = 0;
  }

  stopScene(): void {
    sendAudio({ kind: 'audio', loop: true, action: 'stop', channel: 'ambient' });
    this.playingScene = null;
    this.playingYouTube = false;
    this.position = 0;
    this.duration = 0;
    this.playing = false;
  }

  /** Move the ambient playhead to `seconds` (native <audio> only; no-op for YouTube). */
  seek(seconds: number): void {
    sendAudio({ kind: 'audio', loop: true, action: 'seek', channel: 'ambient', seek: Math.max(0, seconds) });
    this.position = Math.max(0, seconds);
  }

  /** Rewind the ambient track to the start. */
  rewind(): void {
    this.seek(0);
  }

  /**
   * Subscribe to ambient playback-status reports from the broadcast tab. Opens a
   * bus lazily (no import-time side effect) and returns an unsubscribe to call on
   * unmount. Drives the reactive position/duration/playing for the transport UI.
   */
  subscribeStatus(): () => void {
    const bus = createBus();
    const off = bus.on((m) => {
      if (m.type !== 'audioStatus' || m.channel !== 'ambient') return;
      this.position = m.current;
      this.duration = m.duration;
      this.playing = m.playing;
    });
    return () => {
      off();
      bus.close();
    };
  }

  /** Fire a one-shot sound effect (does not loop, does not stop ambience). */
  playSfx(sfxId: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    sendAudio({ kind: 'audio', assetId: s.assetId, loop: false, action: 'play', channel: 'sfx' });
  }

  /**
   * Persist playlist + soundboard metadata (the blobs already live in the asset
   * store; only the track list referencing them needs saving).
   */
  persist(): void {
    void kvSet('audio', {
      playlists: $state.snapshot(this.playlists),
      sfx: $state.snapshot(this.sfx),
      ytAudioOnly: this.ytAudioOnly,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{ playlists?: Playlist[]; sfx?: Sfx[]; ytAudioOnly?: boolean }>(
      'audio'
    );
    if (!saved) return;
    if (saved.playlists?.length) this.playlists = saved.playlists;
    if (saved.sfx) this.sfx = saved.sfx;
    if (typeof saved.ytAudioOnly === 'boolean') this.ytAudioOnly = saved.ytAudioOnly;
  }
}

export const audio = new AudioStore();
