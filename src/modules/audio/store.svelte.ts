import { assetPut, assetDelete, assetUrl, kvGet, kvSet } from '../../lib/db';
import { createBus } from '../../lib/bus';
import type { AudioQueueItem, BroadcastPayload } from '../../lib/types';
import {
  effectiveVolume,
  parseYouTubeId,
  perceptual,
  reorder,
  repeatFlags,
  shuffle,
  type RepeatMode,
  type Scene,
  type Sfx,
  type Track,
} from './logic';

const SEED_SCENES: Scene[] = [
  { id: 'tavern', name: 'Tavern', tracks: [] },
  { id: 'dungeon', name: 'Dungeon', tracks: [] },
  { id: 'boss', name: 'Boss Fight', tracks: [] },
];

/**
 * Normalise a scene loaded from IndexedDB. Older saves used `scene` for the
 * display name (before the Playlist→Scene rename); map it onto `name`.
 */
function normalizeScene(raw: unknown): Scene {
  const s = raw as Partial<Scene> & { scene?: string };
  return {
    id: s.id ?? crypto.randomUUID(),
    name: (s.name ?? s.scene ?? 'Scene').trim() || 'Scene',
    tracks: Array.isArray(s.tracks) ? s.tracks : [],
    gain: typeof s.gain === 'number' ? s.gain : undefined,
  };
}

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

/** Ambient scenes + one-shot SFX, routed to the broadcast tab. */
class AudioStore {
  scenes = $state<Scene[]>([...SEED_SCENES]);
  sfx = $state<Sfx[]>([]);

  /** id of the scene currently playing on air, if any */
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
  /** per-channel + master mute (kept separate from volume so it toggles cleanly) */
  masterMuted = $state(false);
  ambientMuted = $state(false);
  sfxMuted = $state(false);

  /** wall-clock ms of the last ambient status heard from the broadcast tab.
   *  The console uses it to warn when the broadcast tab looks closed. */
  lastStatusAt = $state(0);

  /** GM-tab-only audition element (local preview; never routed to the bus). */
  private auditionEl: HTMLAudioElement | null = null;

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

  /**
   * Effective ambient channel volume sent to the broadcast tab, on a perceptual
   * (squared) curve. Includes the target scene's per-playlist gain trim.
   */
  private ambientGainFor(sceneId?: string | null): number {
    if (this.masterMuted || this.ambientMuted) return 0;
    const id = sceneId ?? this.playingScene;
    const pl = id ? this.scenes.find((p) => p.id === id) : undefined;
    return perceptual(effectiveVolume(this.masterVol, this.ambientVol, pl?.gain ?? 1));
  }
  /** Effective sfx channel volume (per-clip gain applied on top), perceptual curve. */
  private get sfxGain(): number {
    if (this.masterMuted || this.sfxMuted) return 0;
    return perceptual(effectiveVolume(this.masterVol, this.sfxVol));
  }

  /** Toggle mute on a channel (or master), pushing the ambient bed live. */
  toggleMute(channel: 'master' | 'ambient' | 'sfx'): void {
    if (channel === 'master') this.masterMuted = !this.masterMuted;
    else if (channel === 'ambient') this.ambientMuted = !this.ambientMuted;
    else this.sfxMuted = !this.sfxMuted;
    this.pushVolumes();
    this.persist();
  }

  /** Toggle auto-ducking of the ambient bed under SFX. */
  toggleDuck(): void {
    this.duckSfx = !this.duckSfx;
    this.persist();
  }

  /** Import an audio file (or recorded blob) into assets, returning its id. */
  private async importFile(file: Blob, type?: string): Promise<string> {
    return assetPut(file, type || (file as File).type || 'audio/mpeg');
  }

  // ---- scene + track CRUD ---------------------------------------------------

  addScene(name: string): Scene {
    const sc: Scene = { id: crypto.randomUUID(), name: name.trim() || 'New scene', tracks: [] };
    this.scenes.push(sc);
    this.persist();
    return sc;
  }

  renameScene(sceneId: string, name: string): void {
    const sc = this.scenes.find((p) => p.id === sceneId);
    if (!sc) return;
    sc.name = name.trim() || sc.name;
    this.persist();
  }

  removeScene(sceneId: string): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (pl) for (const t of pl.tracks) if (t.assetId) void assetDelete(t.assetId);
    this.scenes = this.scenes.filter((p) => p.id !== sceneId);
    if (this.playingScene === sceneId) this.stopScene();
    this.persist();
  }

  async addTrack(sceneId: string, file: File): Promise<Track | undefined> {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl) return;
    const assetId = await this.importFile(file);
    const track: Track = { id: crypto.randomUUID(), assetId, label: file.name, gain: 1 };
    pl.tracks.push(track);
    this.persist();
    // Read the clip length from metadata (best-effort) and stamp it on the track.
    void readAudioDuration(file).then((secs) => {
      if (secs && Number.isFinite(secs)) {
        track.duration = secs;
        this.persist();
      }
    });
    return track;
  }

  /** Add a YouTube URL as an ambient track. Returns undefined if the url has no id. */
  addYouTube(sceneId: string, url: string, label?: string): Track | undefined {
    const pl = this.scenes.find((p) => p.id === sceneId);
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
    // If the label wasn't supplied, fetch the real video title via oEmbed (no key).
    if (!label?.trim()) {
      void fetchYouTubeTitle(youtubeId).then((title) => {
        if (title && track.label === `YouTube ${youtubeId}`) {
          track.label = title;
          this.persist();
        }
      });
    }
    return track;
  }

  removeTrack(sceneId: string, trackId: string): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl) return;
    const tr = pl.tracks.find((t) => t.id === trackId);
    if (tr?.assetId) void assetDelete(tr.assetId);
    pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
    this.persist();
  }

  renameTrack(sceneId: string, trackId: string, label: string): void {
    const tr = this.scenes.find((p) => p.id === sceneId)?.tracks.find((t) => t.id === trackId);
    if (!tr) return;
    tr.label = label.trim() || tr.label;
    this.persist();
  }

  /** Toggle a track's pin to the widget Ambient board (one-tap start). */
  togglePinTrack(sceneId: string, trackId: string): void {
    const tr = this.scenes.find((p) => p.id === sceneId)?.tracks.find((t) => t.id === trackId);
    if (!tr) return;
    tr.pinned = !tr.pinned;
    this.persist();
  }

  /** Tracks pinned to the widget Ambient board, with their scene + queue index. */
  get pinnedTracks(): { sceneId: string; sceneName: string; track: Track; index: number }[] {
    const out: { sceneId: string; sceneName: string; track: Track; index: number }[] = [];
    for (const sc of this.scenes) {
      sc.tracks.forEach((track, index) => {
        if (track.pinned) out.push({ sceneId: sc.id, sceneName: sc.name, track, index });
      });
    }
    return out;
  }

  /**
   * Start a pinned ambient track from the widget board. YouTube tracks play
   * audio-only by default (no video on the broadcast) so they double as an
   * ambient bed. If it's already the on-air track, toggle pause instead.
   */
  playPinnedTrack(sceneId: string, index: number): void {
    if (this.playingScene === sceneId && this.trackIndex === index) {
      this.togglePause();
      return;
    }
    this.playSceneAt(sceneId, index, true);
  }

  /** Move a track within its playlist by `delta` (e.g. -1 up, +1 down). */
  moveTrack(sceneId: string, index: number, delta: number): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl) return;
    pl.tracks = reorder(pl.tracks, index, index + delta);
    this.persist();
  }

  /** Move a track from one index to another (drag-to-reorder). */
  moveTrackTo(sceneId: string, from: number, to: number): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl || from === to) return;
    pl.tracks = reorder(pl.tracks, from, to);
    this.persist();
  }

  /** Set a track's gain trim (0..1) and push it live if it's the on-air track. */
  setTrackGain(sceneId: string, trackId: string, gain: number): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    const tr = pl?.tracks.find((t) => t.id === trackId);
    if (!pl || !tr) return;
    tr.gain = Math.min(1, Math.max(0, gain));
    this.persist();
    // If this scene is on air, re-send the queue so the new gain takes effect.
    if (this.playingScene === sceneId) this.requeue(sceneId);
  }

  // ---- ambient transport ----------------------------------------------------

  /** Build the queue cue for a playlist (does not change playhead). */
  private queueCue(
    sceneId: string,
    index = 0,
    audioOnly = this.ytAudioOnly
  ): Extract<BroadcastPayload, { kind: 'audio' }> | null {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl || !pl.tracks.length) return null;
    return {
      kind: 'audio',
      channel: 'ambient',
      action: 'play',
      queue: pl.tracks.map((t) => toQueueItem(t, audioOnly)),
      index,
      loopTrack: this.loopTrack,
      loopList: this.loopList,
      crossfadeMs: this.crossfadeMs,
      volume: this.ambientGainFor(sceneId),
    };
  }

  /** Play a scene playlist as looping ambience from the first track. */
  playScene(sceneId: string): void {
    this.playSceneAt(sceneId, 0);
  }

  /** Play a scene playlist starting at a specific track index (click-to-play). */
  playSceneAt(sceneId: string, index: number, audioOnly = this.ytAudioOnly): void {
    const cue = this.queueCue(sceneId, index, audioOnly);
    if (!cue) return;
    sendAudio(cue);
    const pl = this.scenes.find((p) => p.id === sceneId)!;
    this.playingScene = sceneId;
    this.playingYouTube = !!pl.tracks[index]?.youtubeId;
    this.paused = false;
    this.position = 0;
    this.duration = 0;
    this.trackIndex = index;
    this.trackCount = pl.tracks.length;
    this.syncMonitor();
  }

  /** Randomise a scene's track order (persisted). Re-queues if on air. */
  shuffleScene(sceneId: string): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl) return;
    pl.tracks = shuffle(pl.tracks);
    this.persist();
    if (this.playingScene === sceneId) this.requeue(sceneId);
  }

  /** Set a playlist's gain trim (0..1). Pushes live if the scene is on air. */
  setSceneGain(sceneId: string, gain: number): void {
    const pl = this.scenes.find((p) => p.id === sceneId);
    if (!pl) return;
    pl.gain = clamp01(gain);
    this.persist();
    if (this.playingScene === sceneId) this.pushVolumes();
  }

  /** Re-send the on-air queue keeping the current index (after edits/gain). */
  private requeue(sceneId: string): void {
    const cue = this.queueCue(sceneId, this.trackIndex);
    if (cue) sendAudio(cue);
  }

  stopScene(): void {
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'stop' });
    this.stopMonitor();
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
    this.stopMonitor();
  }

  resume(): void {
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'resume' });
    this.paused = false;
    this.syncMonitor();
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

  /** Current repeat mode derived from the two wire booleans. */
  get repeat(): RepeatMode {
    return this.loopTrack ? 'track' : this.loopList ? 'scene' : 'off';
  }

  /** Set repeat as one control (Off / Scene / Track); re-queues if on air. */
  setRepeat(mode: RepeatMode): void {
    const flags = repeatFlags(mode);
    this.loopList = flags.loopList;
    this.loopTrack = flags.loopTrack;
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
    if (this.monitorEl) this.monitorEl.volume = this.ambientGainFor();
    if (!this.playingScene) return;
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'volume', volume: this.ambientGainFor() });
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
    const s = this.sfx.find((x) => x.id === sfxId);
    if (s?.assetId) void assetDelete(s.assetId);
    this.sfx = this.sfx.filter((x) => x.id !== sfxId);
    this.persist();
  }

  renameSfx(sfxId: string, label: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.label = label.trim() || s.label;
    this.persist();
  }

  /** Set a clip's Quick Board alias (short display name; blank clears it). */
  setSfxAlias(sfxId: string, alias: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.alias = alias.trim() || undefined;
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

  /** Toggle a clip's pin to the widget Quick Board (hotkeys 1–9). */
  togglePin(sfxId: string): void {
    const s = this.sfx.find((x) => x.id === sfxId);
    if (!s) return;
    s.pinned = !s.pinned;
    this.persist();
  }

  /** Clips pinned to the widget Quick Board, in soundboard order. */
  get pinnedSfx(): Sfx[] {
    return this.sfx.filter((s) => s.pinned);
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

  /** Play the Nth pinned Quick Board clip (1-based) — drives number-key hotkeys. */
  playSfxByHotkey(n: number): void {
    const s = this.pinnedSfx[n - 1];
    if (s) this.playSfx(s.id);
  }

  /**
   * Kill switch: hard-stop every channel on the broadcast tab (ambient bed +
   * all live SFX) and reset local transport. For "oops, wrong clip on air".
   */
  panic(): void {
    sendAudio({ kind: 'audio', channel: 'ambient', action: 'panic' });
    this.stopAudition();
    this.stopMonitor();
    this.playingScene = null;
    this.playingYouTube = false;
    this.paused = false;
    this.playing = false;
    this.position = 0;
    this.duration = 0;
    this.trackIndex = 0;
    this.trackCount = 0;
  }

  /**
   * Audition an asset in the GM tab only — a private preview that never touches
   * the broadcast bus. Stops any previous audition. Pass no id to just stop.
   */
  audition(assetId?: string): void {
    this.stopAudition();
    if (!assetId || typeof Audio === 'undefined') return;
    void assetUrl(assetId).then((url) => {
      if (!url) return;
      const el = new Audio(url);
      el.volume = perceptual(this.sfxVol);
      el.onended = () => URL.revokeObjectURL(url);
      this.auditionEl = el;
      void el.play().catch(() => URL.revokeObjectURL(url));
    });
  }

  /** Stop the current GM-tab audition, if any. */
  stopAudition(): void {
    if (this.auditionEl) {
      this.auditionEl.pause();
      this.auditionEl = null;
    }
  }

  // ---- GM monitor -----------------------------------------------------------

  /** Local monitor: hear the ambient bed in the GM tab (even with broadcast closed). */
  monitor = $state(false);
  private monitorEl: HTMLAudioElement | null = null;

  /** Toggle the GM-local monitor on/off. */
  setMonitor(on: boolean): void {
    this.monitor = on;
    this.persist();
    if (on) this.syncMonitor();
    else this.stopMonitor();
  }

  /**
   * (Re)load the local monitor so it mirrors the current on-air ambient track.
   * Native audio only — YouTube tracks can't be monitored locally. Best-effort;
   * not sample-synced to the broadcast tab, just an audible reference.
   */
  syncMonitor(): void {
    if (!this.monitor || typeof Audio === 'undefined') return;
    const cur = this.scenes.find((p) => p.id === this.playingScene)?.tracks[this.trackIndex];
    if (!this.playingScene || this.paused || !cur?.assetId) {
      this.stopMonitor();
      return;
    }
    const assetId = cur.assetId;
    this.stopMonitor();
    void assetUrl(assetId).then((url) => {
      if (!url || !this.monitor) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      const el = new Audio(url);
      el.loop = this.loopTrack;
      el.volume = this.ambientGainFor();
      el.onended = () => URL.revokeObjectURL(url);
      this.monitorEl = el;
      void el.play().catch(() => URL.revokeObjectURL(url));
    });
  }

  private stopMonitor(): void {
    if (this.monitorEl) {
      this.monitorEl.pause();
      this.monitorEl = null;
    }
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
      this.lastStatusAt = Date.now();
      this.position = m.current;
      this.duration = m.duration;
      this.playing = m.playing;
      const prevIndex = this.trackIndex;
      if (typeof m.index === 'number') this.trackIndex = m.index;
      if (typeof m.count === 'number') this.trackCount = m.count;
      const cur = this.scenes.find((p) => p.id === this.playingScene)?.tracks[this.trackIndex];
      this.playingYouTube = !!cur?.youtubeId;
      // Follow track advances driven by the broadcast engine on the local monitor.
      if (this.monitor && this.trackIndex !== prevIndex) this.syncMonitor();
    });
    return () => {
      off();
      bus.close();
    };
  }

  /**
   * Persist scenes + soundboard metadata + mixer prefs (the blobs already live
   * in the asset store; only the lists referencing them need saving).
   */
  persist(): void {
    void kvSet('audio', {
      scenes: $state.snapshot(this.scenes),
      sfx: $state.snapshot(this.sfx),
      ytAudioOnly: this.ytAudioOnly,
      masterVol: this.masterVol,
      ambientVol: this.ambientVol,
      sfxVol: this.sfxVol,
      crossfadeMs: this.crossfadeMs,
      loopList: this.loopList,
      loopTrack: this.loopTrack,
      duckSfx: this.duckSfx,
      masterMuted: this.masterMuted,
      ambientMuted: this.ambientMuted,
      sfxMuted: this.sfxMuted,
      monitor: this.monitor,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{
      /** current key */
      scenes?: unknown[];
      /** legacy key (pre Playlist→Scene rename) */
      playlists?: unknown[];
      sfx?: Sfx[];
      ytAudioOnly?: boolean;
      masterVol?: number;
      ambientVol?: number;
      sfxVol?: number;
      crossfadeMs?: number;
      loopList?: boolean;
      loopTrack?: boolean;
      duckSfx?: boolean;
      masterMuted?: boolean;
      ambientMuted?: boolean;
      sfxMuted?: boolean;
      monitor?: boolean;
    }>('audio');
    if (!saved) return;
    // Presence, not length: an empty array means the GM deleted every scene —
    // honour that instead of resurrecting the seed list on reload. Accept the
    // legacy `playlists` key and normalise each entry's `scene`→`name`.
    const rawScenes = saved.scenes ?? saved.playlists;
    if (Array.isArray(rawScenes)) this.scenes = rawScenes.map(normalizeScene);
    if (saved.sfx) this.sfx = saved.sfx;
    if (typeof saved.ytAudioOnly === 'boolean') this.ytAudioOnly = saved.ytAudioOnly;
    if (typeof saved.masterVol === 'number') this.masterVol = clamp01(saved.masterVol);
    if (typeof saved.ambientVol === 'number') this.ambientVol = clamp01(saved.ambientVol);
    if (typeof saved.sfxVol === 'number') this.sfxVol = clamp01(saved.sfxVol);
    if (typeof saved.crossfadeMs === 'number') this.crossfadeMs = Math.max(0, saved.crossfadeMs);
    if (typeof saved.loopList === 'boolean') this.loopList = saved.loopList;
    if (typeof saved.loopTrack === 'boolean') this.loopTrack = saved.loopTrack;
    if (typeof saved.duckSfx === 'boolean') this.duckSfx = saved.duckSfx;
    if (typeof saved.masterMuted === 'boolean') this.masterMuted = saved.masterMuted;
    if (typeof saved.ambientMuted === 'boolean') this.ambientMuted = saved.ambientMuted;
    if (typeof saved.sfxMuted === 'boolean') this.sfxMuted = saved.sfxMuted;
    if (typeof saved.monitor === 'boolean') this.monitor = saved.monitor;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

/** Read an audio file's duration (seconds) via a throwaway element. Best-effort. */
function readAudioDuration(file: Blob): Promise<number | undefined> {
  if (typeof Audio === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    const done = (secs?: number) => {
      URL.revokeObjectURL(url);
      resolve(secs);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : undefined);
    el.onerror = () => done(undefined);
    el.src = url;
  });
}

/** Fetch a YouTube video's title via oEmbed (no API key). Returns undefined on failure. */
async function fetchYouTubeTitle(id: string): Promise<string | undefined> {
  if (typeof fetch !== 'function') return undefined;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { title?: string };
    return typeof data.title === 'string' ? data.title : undefined;
  } catch {
    return undefined;
  }
}

export const audio = new AudioStore();
