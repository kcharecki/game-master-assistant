import { assetPut, assetUrl } from '../../lib/db';
import { createBus } from '../../lib/bus';
import type { BroadcastPayload } from '../../lib/types';
import type { Playlist, Sfx, Track } from './logic';

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
    return track;
  }

  async addSfx(file: File): Promise<Sfx> {
    const assetId = await this.importFile(file);
    const s: Sfx = { id: crypto.randomUUID(), assetId, label: file.name };
    this.sfx.push(s);
    return s;
  }

  /** Play the first track of a scene playlist as looping ambience. */
  async playScene(playlistId: string): Promise<void> {
    const pl = this.playlists.find((p) => p.id === playlistId);
    const first = pl?.tracks[0];
    if (!first) return;
    const url = await assetUrl(first.assetId);
    if (!url) return;
    sendAudio({ kind: 'audio', src: url, loop: true, action: 'play', channel: 'ambient' });
    this.playingScene = playlistId;
  }

  stopScene(): void {
    sendAudio({ kind: 'audio', src: '', loop: true, action: 'stop', channel: 'ambient' });
    this.playingScene = null;
  }

  /** Fire a one-shot sound effect (does not loop, does not stop ambience). */
  async playSfx(sfxId: string): Promise<void> {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    const url = await assetUrl(s.assetId);
    if (!url) return;
    sendAudio({ kind: 'audio', src: url, loop: false, action: 'play', channel: 'sfx' });
  }
}

export const audio = new AudioStore();
