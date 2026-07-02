import { assetPut, kvGet, kvSet } from '../../lib/db';
import { createBus } from '../../lib/bus';
import type { AudioQueueItem, BroadcastPayload } from '../../lib/types';
import {
  effectiveVolume,
  parseYouTubeId,
  reorder,
  type Playlist,
  type Sfx,
  type Track,
} from './logic';

const SEED_PLAYLISTS: Playlist[] = [
  { id: 'tavern', scene: 'Tavern', tracks: [] },
  { id: 'dungeon', scene: 'Dungeon', tracks: [] },
  { id: 'boss', scene: 'Boss Fight', tracks: [] },
];

const DEFAULT_CROSSFADE_MS = 1500;

/** Send an audio cue to the broadcast tab's sequencer. */
function sendAudio(payload: Extract<BroadcastPayload, { kind: 'audio' }>): void {
  const bus = createBus();
  bus.send(payload);
  bus.close();
}

/** Map a stored track to a queue item the broadcast sequencer understands. */
function toQueueItem(t: Track, audioOnly: boolean): AudioQueueItem {
  return {
    assetId: t.assetId,
    youtubeId: t.youtubeId,
    audioOnly: t.youtubeId ? audioOnly : undefined,
    gain: t.gain ?? 1,
    label: t.label,
  };
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

  // Mixer (0..1). Master scales every channel; ambient/sfx are per-channel trims.
  masterVol = $state(1);
  ambientVol = $state(0.8);
  sfxVol = $state(0.9);
  /** crossfade between ambient tracks, ms */
  crossfadeMs = $state(DEFAULT_CROSSFADE_MS);
  /** wrap the ambient queue after the last track */
  loopList = $state(true);
  /** repeat the current track instead of advancing */
  loopTrack = $state(false);
  /** auto-duck the ambient bed while an SFX plays */
  duckSfx = $state(true);

  // Reactive ambient transport state, fed by the broadcast tab's audioStatus
  // reports over the reverse bus channel (see subscribeStatus).
  position = $state(0);
  duration = $state(0);
  playing = $state(false);
  paused = $state(false);
  /** index/count of the on-air ambient track within its queue */
  trackIndex = $state(0);
  trackCount = $state(0);

  /** recording state (mic capture in the GM tab) */
  recording = $state(false);
  private recorder: MediaRecorder | null = null;
  private recChunks: Blob[] = [];

  /** Effective ambient channel volume sent to the broadcast tab. */
  private get ambientGain(): number {
    return effectiveVolume(this.masterVol, this.ambientVol);
  }
  /** Effective sfx channel volume (per-track gain applied in the broadcast tab). */
  private get sfxGain(): number {
    return effectiveVolume(this.masterVol, this.sfxVol);
  }

  /** Import an audio file (or recorded blob) into assets, returning its id. */
  private async importFile(file: Blob, type?: string): Promise<string> {
    return assetPut(file, type || (file as File).type || 'audio/mpeg');
  }

  // ---- playlist + track CRUD ------------------------------------------------

  addPlaylist(scene: string): Playlist {
    const pl: Playlist = { id: crypto.randomUUID(), scene: scene.trim() || 'New scene', tracks: [] };
    this.playlists.push(pl);
    this.persist();
    return pl;
  }

  renamePlaylist(playlistId: string, scene: string): void {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    pl.scene = scene.trim() || pl.scene;
    this.persist();
  }

  removePlaylist(playlistId: string): void {
    this.playlists = this.playlists.filter((p) => p.id !== playlistId);
    if (this.playingScene === playlistId) this.stopScene();
    this.persist();
  }

  async addTrack(playlistId: string, file: File): Promise<Track | undefined> {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const assetId = await this.importFile(file);
    const track: Track = { id: crypto.randomUUID(), assetId, label: file.name, gain: 1 };
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
      gain: 1,
    };
    pl.tracks.push(track);
    this.persist();
    return track;
  }

  removeTrack(playlistId: string, trackId: string): void {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
    this.persist();
  }

  renameTrack(playlistId: string, trackId: string, label: string): void {
    const tr = this.playlists.find((p) => p.id === playlistId)?.tracks.find((t) => t.id === trackId);
    if (!tr) return;
    tr.label = label.trim() || tr.label;
    this.persist();
  }

  /** Move a track within its playlist by `delta` (e.g. -1 up, +1 down). */
  moveTrack(playlistId: string, index: number, delta: number): void {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    pl.tracks = reorder(pl.tracks, index, index + delta);
    this.persist();
  }

  /** Set a track's gain trim (0..1) and push it live if it's the on-air track. */
  setTrackGain(playlistId: string, trackId: string, gain: number): void {
    const pl = this.playlists.find((p) => p.id === playlistId);
    const tr = pl?.tracks.find((t) => t.id === trackId);
    if (!pl || !tr) return;
    tr.gain = Math.min(1, Math.max(0, gain));
    this.persist();
    // If this scene is on air, re-send the queue so the new gain takes effect.
    if (this.playingScene === playlistId) this.requeue(playlistId);
  }

  // ---- ambient transport ----------------------------------------------------

  /** Build the queue cue for a playlist (does not change playhead). */
  private queueCue(playlistId: string, index = 0): Extract<BroadcastPayload, { kind: 'audio' }> | null {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl || !pl.tracks.length) return null;
    return {
      kind: 'audio',
      channel: 'ambient',
      action: 'play',
      queue: pl.tracks.map((t) => toQueueItem(t, this.ytAudioOnly)),
      index,
      loopTrack: this.loopTrack,
      loopList: this.loopList,
      crossfadeMs: this.crossfadeMs,
      volume: this.ambientGain,
    };
  }

  /** Play a scene playlist as looping ambience from the first track. */
  playScene(playlistId: string): void {
    const cue = this.queueCue(playlistId, 0);
    if (!cue) return;
    sendAudio(cue);
    const pl = this.playlists.find((p) => p.id === playlistId)!;
    this.playingScene = playlistId;
    this.playingYouTube = !!pl.tracks[0]?.youtubeId;
    this.paused = false;
    this.position = 0;
    this.duration = 0;
    this.trackIndex = 0;
    this.trackCount = pl.tracks.length;
  }

  /** Re-send the on-air queue keeping the current index (after edits/gain). */
  private requeue(playlistId: string): void {
    const cue = this.queueCue(playlistId, this.trackIndex);
    if (cue) sendAudio(cue);
  }

  stopScene(): void {
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'stop' });
    this.playingScene = null;
    this.playingYouTube = false;
    this.paused = false;
    this.position = 0;
    this.duration = 0;
    this.playing = false;
    this.trackIndex = 0;
    this.trackCount = 0;
  }

  pause(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'pause' });
    this.paused = true;
  }

  resume(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'resume' });
    this.paused = false;
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  next(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'next' });
  }

  prev(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'prev' });
  }

  /** Move the ambient playhead to `seconds` (native <audio> only; no-op for YouTube). */
  seek(seconds: number): void {
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'seek', seek: Math.max(0, seconds) });
    this.position = Math.max(0, seconds);
  }

  /** Rewind the ambient track to the start. */
  rewind(): void {
    this.seek(0);
  }

  toggleLoopList(): void {
    this.loopList = !this.loopList;
    this.persist();
    if (this.playingScene) this.requeue(this.playingScene);
  }

  toggleLoopTrack(): void {
    this.loopTrack = !this.loopTrack;
    this.persist();
    if (this.playingScene) this.requeue(this.playingScene);
  }

  setCrossfade(ms: number): void {
    this.crossfadeMs = Math.max(0, Math.round(ms));
    this.persist();
    if (this.playingScene) this.requeue(this.playingScene);
  }

  // ---- mixer ----------------------------------------------------------------

  setMasterVol(v: number): void {
    this.masterVol = clamp01(v);
    this.pushVolumes();
    this.persist();
  }
  setAmbientVol(v: number): void {
    this.ambientVol = clamp01(v);
    this.pushVolumes();
    this.persist();
  }
  setSfxVol(v: number): void {
    this.sfxVol = clamp01(v);
    this.persist(); // sfx volume is read per-shot; nothing live to push
  }

  /** Push the live ambient channel volume to the running sequencer. */
  private pushVolumes(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'volume', volume: this.ambientGain });
  }

  // ---- soundboard -----------------------------------------------------------

  async addSfx(file: File, group?: string): Promise<Sfx> {
    const assetId = await this.importFile(file);
    const s: Sfx = { id: crypto.randomUUID(), assetId, label: file.name, group, gain: 1 };
    this.sfx.push(s);
    this.persist();
    return s;
  }

  removeSfx(sfxId: string): void {
    this.sfx = this.sfx.filter((x) => x.id !== sfxId);
    this.persist();
  }

  renameSfx(sfxId: string, label: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.label = label.trim() || s.label;
    this.persist();
  }

  setSfxGroup(sfxId: string, group: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.group = group.trim() || undefined;
    this.persist();
  }

  setSfxGain(sfxId: string, gain: number): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.gain = clamp01(gain);
    this.persist();
  }

  /** Distinct, ordered soundboard groups (ungrouped clips fall under ''). */
  get sfxGroups(): string[] {
    const seen = new Set<string>();
    for (const s of this.sfx) seen.add(s.group ?? '');
    return [...seen];
  }

  /** Fire a one-shot sound effect (overlaps ambience; pooled, can duck the bed). */
  playSfx(sfxId: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    sendAudio({
      kind: 'audio',
      channel: 'sfx',
      action: 'play',
      assetId: s.assetId,
      volume: effectiveVolume(this.sfxGain, s.gain ?? 1),
      duck: this.duckSfx,
    });
  }

  /** Play the Nth soundboard clip (1-based) — drives number-key hotkeys. */
  playSfxByHotkey(n: number): void {
    const s = this.sfx[n - 1];
    if (s) this.playSfx(s.id);
  }

  // ---- mic recording (GM tab) ----------------------------------------------

  /** Start capturing mic audio into a new soundboard clip. Resolves on grant. */
  async startRecording(): Promise<boolean> {
    if (this.recording) return false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }
    this.recChunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size) this.recChunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(this.recChunks, { type: rec.mimeType || 'audio/webm' });
      this.recChunks = [];
      void this.importFile(blob, blob.type).then((assetId) => {
        const stamp = new Date().toLocaleTimeString();
        this.sfx.push({ id: crypto.randomUUID(), assetId, label: `Rec ${stamp}`, gain: 1 });
        this.persist();
      });
    };
    this.recorder = rec;
    rec.start();
    this.recording = true;
    return true;
  }

  stopRecording(): void {
    if (!this.recording || !this.recorder) return;
    this.recorder.stop();
    this.recorder = null;
    this.recording = false;
  }

  // ---- status link + persistence -------------------------------------------

  /**
   * Subscribe to ambient playback-status reports from the broadcast tab. Opens a
   * bus lazily and returns an unsubscribe to call on unmount. Drives the reactive
   * transport (position/duration/playing + queue index).
   */
  subscribeStatus(): () => void {
    const bus = createBus();
    const off = bus.on((m) => {
      if (m.type !== 'audioStatus' || m.channel !== 'ambient') return;
      this.position = m.current;
      this.duration = m.duration;
      this.playing = m.playing;
      if (typeof m.index === 'number') this.trackIndex = m.index;
      if (typeof m.count === 'number') this.trackCount = m.count;
      const cur = this.playlists.find((p) => p.id === this.playingScene)?.tracks[this.trackIndex];
      this.playingYouTube = !!cur?.youtubeId;
    });
    return () => {
      off();
      bus.close();
    };
  }

  /**
   * Persist playlist + soundboard metadata + mixer prefs (the blobs already live
   * in the asset store; only the lists referencing them need saving).
   */
  persist(): void {
    void kvSet('audio', {
      playlists: $state.snapshot(this.playlists),
      sfx: $state.snapshot(this.sfx),
      ytAudioOnly: this.ytAudioOnly,
      masterVol: this.masterVol,
      ambientVol: this.ambientVol,
      sfxVol: this.sfxVol,
      crossfadeMs: this.crossfadeMs,
      loopList: this.loopList,
      loopTrack: this.loopTrack,
      duckSfx: this.duckSfx,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{
      playlists?: Playlist[];
      sfx?: Sfx[];
      ytAudioOnly?: boolean;
      masterVol?: number;
      ambientVol?: number;
      sfxVol?: number;
      crossfadeMs?: number;
      loopList?: boolean;
      loopTrack?: boolean;
      duckSfx?: boolean;
    }>('audio');
    if (!saved) return;
    // Presence, not length: an empty array means the GM deleted every scene —
    // honour that instead of resurrecting the seed list on reload.
    if (Array.isArray(saved.playlists)) this.playlists = saved.playlists;
    if (saved.sfx) this.sfx = saved.sfx;
    if (typeof saved.ytAudioOnly === 'boolean') this.ytAudioOnly = saved.ytAudioOnly;
    if (typeof saved.masterVol === 'number') this.masterVol = clamp01(saved.masterVol);
    if (typeof saved.ambientVol === 'number') this.ambientVol = clamp01(saved.ambientVol);
    if (typeof saved.sfxVol === 'number') this.sfxVol = clamp01(saved.sfxVol);
    if (typeof saved.crossfadeMs === 'number') this.crossfadeMs = Math.max(0, saved.crossfadeMs);
    if (typeof saved.loopList === 'boolean') this.loopList = saved.loopList;
    if (typeof saved.loopTrack === 'boolean') this.loopTrack = saved.loopTrack;
    if (typeof saved.duckSfx === 'boolean') this.duckSfx = saved.duckSfx;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export const audio = new AudioStore();
