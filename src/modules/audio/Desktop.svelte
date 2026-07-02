<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime } from './logic';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';

  let sfxGroup = $state(''); // active soundboard group filter ('' = all)
  let pickScene = $state(audio.playingScene ?? audio.playlists[0]?.id ?? '');
  let mixerOpen = $state(false);
  let dropping = $state(false);
  let flashing = $state<Record<string, boolean>>({}); // sfx id -> mid-flash
  let warnClosed = $state(false);

  const onAirPlaylist = $derived(audio.playlists.find((p) => p.id === audio.playingScene));
  const onAirTracks = $derived(onAirPlaylist?.tracks ?? []);
  const curTrack = $derived(onAirTracks[audio.trackIndex]);
  const nextTrack = $derived(
    onAirTracks.length
      ? onAirTracks[(audio.trackIndex + 1) % onAirTracks.length] &&
          (audio.trackIndex + 1 < onAirTracks.length || audio.loopList)
        ? onAirTracks[(audio.trackIndex + 1) % onAirTracks.length]
        : undefined
      : undefined
  );
  const remaining = $derived(Math.max(0, audio.duration - audio.position));
  const shownSfx = $derived(
    sfxGroup ? audio.sfx.filter((s) => (s.group ?? '') === sfxGroup) : audio.sfx
  );
  const groups = $derived(audio.sfxGroups);

  // Hide the broadcast-closed warning as soon as status starts flowing again.
  $effect(() => {
    if (audio.lastStatusAt) warnClosed = false;
  });

  onMount(() => {
    void audio.load();
    const offStatus = audio.subscribeStatus();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.key === ' ' && audio.playingScene) {
        e.preventDefault();
        audio.togglePause();
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        const s = shownSfx[Number(e.key) - 1];
        if (s) playPad(s.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offStatus();
      window.removeEventListener('keydown', onKey);
    };
  });

  // --- seek drag freeze (hold thumb against incoming audioStatus) ---
  let seeking = $state(false);
  let seekPos = $state(0);
  const seekValue = $derived(seeking ? seekPos : audio.position);
  const onSeekInput = (e: Event) => (seekPos = (e.currentTarget as HTMLInputElement).valueAsNumber);
  function onSeekStart() {
    seekPos = audio.position;
    seeking = true;
  }
  function onSeekCommit() {
    if (!seeking) return;
    seeking = false;
    audio.seek(seekPos);
  }

  function playScene() {
    if (!pickScene) return;
    const before = audio.lastStatusAt;
    audio.playScene(pickScene);
    // If no status report lands shortly, the broadcast tab is probably closed.
    setTimeout(() => {
      if (audio.playingScene && audio.lastStatusAt === before) warnClosed = true;
    }, 1300);
  }

  function playPad(id: string) {
    audio.playSfx(id);
    flashing[id] = true;
    setTimeout(() => (flashing[id] = false), 650);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dropping = false;
    for (const f of e.dataTransfer?.files ?? [])
      if (f.type.startsWith('audio/')) void audio.addSfx(f, sfxGroup || undefined);
  }

  function openBroadcast() {
    window.open('broadcast.html', 'gm-broadcast', 'width=1280,height=720');
  }

  // Stable-ish colour per group name (verdigris-family hues).
  function groupColor(name: string): string {
    if (!name) return 'var(--green-dim)';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${h} 42% 34%)`;
  }
</script>

<div class="audio" data-no-drag>
  {#if warnClosed}
    <div class="warn">
      <span>{t('audio.broadcastClosed')}</span>
      <button class="btn sm" onclick={openBroadcast}>{t('audio.openBroadcast')}</button>
    </div>
  {/if}

  <!-- Now playing -->
  <section class="nowbox">
    <div class="nowlabel">{audio.playingScene ? (curTrack?.label ?? t('audio.nowPlaying')) : t('audio.nothingPlaying')}</div>
    {#if audio.playingScene}
      <div class="nowmeta">
        {#if audio.playingYouTube}
          <span><Icon name="play" size={11} /> YT {audio.trackIndex + 1}/{audio.trackCount}</span>
        {:else}
          <span class="tnum">{formatTime(audio.position)}</span>
          <span class="rem">-{formatTime(remaining)}</span>
        {/if}
        {#if nextTrack}<span class="next">{t('audio.nextUp')}: {nextTrack.label}</span>{/if}
      </div>
      <input
        type="range"
        class="seek"
        min="0"
        max={audio.duration || 0}
        step="0.1"
        value={seekValue}
        oninput={onSeekInput}
        onpointerdown={onSeekStart}
        onpointerup={onSeekCommit}
        onkeydown={onSeekStart}
        onkeyup={onSeekCommit}
        onchange={onSeekCommit}
        disabled={audio.playingYouTube || audio.duration <= 0}
        aria-label={t('audio.seek')}
      />
    {/if}

    <!-- Transport -->
    <div class="transport">
      <button class="ic" onclick={() => audio.prev()} disabled={!audio.playingScene} title={t('audio.prev')} aria-label={t('audio.prev')}><Icon name="prev" /></button>
      <button class="ic big" onclick={() => audio.togglePause()} disabled={!audio.playingScene} title={audio.paused ? t('audio.resume') : t('audio.pause')} aria-label={audio.paused ? t('audio.resume') : t('audio.pause')}><Icon name={audio.paused ? 'play' : 'pause'} /></button>
      <button class="ic" onclick={() => audio.next()} disabled={!audio.playingScene} title={t('audio.next')} aria-label={t('audio.next')}><Icon name="next" /></button>
      <button class="ic" onclick={() => audio.stopScene()} disabled={!audio.playingScene} title={t('audio.stop')} aria-label={t('audio.stop')}><Icon name="stop" /></button>
      <button class="ic" class:on={audio.loopList} onclick={() => audio.toggleLoopList()} title={t('audio.loopList')} aria-label={t('audio.loopList')}>🔁</button>
      <button class="ic" class:on={audio.loopTrack} onclick={() => audio.toggleLoopTrack()} title={t('audio.loopTrack')} aria-label={t('audio.loopTrack')}>🔂</button>
    </div>

    <!-- Scene switch -->
    <div class="scenerow">
      <select class="in" bind:value={pickScene} aria-label={t('audio.switchScene')}>
        {#each audio.playlists as p (p.id)}
          <option value={p.id}>{p.scene} ({p.tracks.length})</option>
        {/each}
      </select>
      <button class="btn sm solid" onclick={playScene} disabled={!pickScene}>{t('audio.play')}</button>
    </div>
  </section>

  <!-- Master + mixer popover + panic -->
  <section class="masterbar">
    <label class="mvol" title={t('audio.vol.master')}>
      <button class="ic" class:muted={audio.masterMuted} onclick={() => audio.toggleMute('master')} aria-label={t('audio.mute')}>{audio.masterMuted ? '🔇' : '🔊'}</button>
      <input type="range" min="0" max="1" step="0.01" value={audio.masterVol} oninput={(e) => audio.setMasterVol(e.currentTarget.valueAsNumber)} />
      <span class="pct">{Math.round(audio.masterVol * 100)}</span>
    </label>
    <button class="btn sm" class:on={mixerOpen} onclick={() => (mixerOpen = !mixerOpen)}>{t('audio.mixer')}</button>
    <button class="btn sm panic" onclick={() => audio.panic()} title={t('audio.panicTitle')}>⛔ {t('audio.panic')}</button>
  </section>

  {#if mixerOpen}
    <section class="mixerpop">
      <label class="cvol">
        <span>{t('audio.vol.ambient')}</span>
        <button class="ic" class:muted={audio.ambientMuted} onclick={() => audio.toggleMute('ambient')} aria-label={t('audio.mute')}>{audio.ambientMuted ? '🔇' : '🔊'}</button>
        <input type="range" min="0" max="1" step="0.01" value={audio.ambientVol} oninput={(e) => audio.setAmbientVol(e.currentTarget.valueAsNumber)} />
        <span class="pct">{Math.round(audio.ambientVol * 100)}</span>
      </label>
      <label class="cvol">
        <span>{t('audio.vol.sfx')}</span>
        <button class="ic" class:muted={audio.sfxMuted} onclick={() => audio.toggleMute('sfx')} aria-label={t('audio.mute')}>{audio.sfxMuted ? '🔇' : '🔊'}</button>
        <input type="range" min="0" max="1" step="0.01" value={audio.sfxVol} oninput={(e) => audio.setSfxVol(e.currentTarget.valueAsNumber)} />
        <span class="pct">{Math.round(audio.sfxVol * 100)}</span>
      </label>
      <label class=" duck"><input type="checkbox" checked={audio.duckSfx} onchange={() => audio.toggleDuck()} /> {t('audio.duck')}</label>
    </section>
  {/if}

  <!-- Soundboard pads -->
  <section
    class="board"
    class:dropping
    ondragover={(e) => {
      e.preventDefault();
      dropping = true;
    }}
    ondragleave={() => (dropping = false)}
    ondrop={onDrop}
    role="group"
    aria-label={t('audio.soundboard')}
  >
    {#if groups.length > 1}
      <div class="grouprow">
        <button class="chip flt" class:on={sfxGroup === ''} onclick={() => (sfxGroup = '')}>{t('audio.allGroups')}</button>
        {#each groups as g (g)}
          {#if g}
            <button class="chip flt" class:on={sfxGroup === g} onclick={() => (sfxGroup = g)}>{g}</button>
          {/if}
        {/each}
      </div>
    {/if}
    <div class="pads">
      {#each shownSfx as s, i (s.id)}
        <button
          class="pad"
          class:flash={flashing[s.id]}
          style="--pad:{groupColor(s.group ?? '')}"
          onclick={() => playPad(s.id)}
          oncontextmenu={(e) => {
            e.preventDefault();
            audio.audition(s.assetId);
          }}
          title={t('audio.audition')}
        >
          {#if i < 9}<kbd>{i + 1}</kbd>{/if}
          <span class="padlabel">{s.label}</span>
        </button>
      {:else}
        <span class="muted">{t('audio.soundboardHint')}</span>
      {/each}
    </div>
  </section>
</div>

<style>
  .audio {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13px;
    color: var(--txt);
  }
  .warn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    background: rgba(255, 90, 90, 0.14);
    border: 1px solid rgba(255, 90, 90, 0.5);
    color: #ffb3b3;
    font-size: 12px;
  }
  .warn span {
    flex: 1;
  }
  .nowbox {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line2);
  }
  .nowlabel {
    font-family: Georgia, serif;
    font-size: 17px;
    color: var(--green);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nowmeta {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    flex-wrap: wrap;
  }
  .nowmeta .rem {
    color: var(--faint);
  }
  .nowmeta .next {
    margin-left: auto;
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 55%;
  }
  .seek {
    width: 100%;
    accent-color: var(--green);
  }
  .transport {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .scenerow {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .masterbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mvol {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }
  .mvol input {
    flex: 1;
    min-width: 0;
    accent-color: var(--green);
  }
  .mixerpop {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line2);
  }
  .cvol {
    display: grid;
    grid-template-columns: 54px 26px 1fr 26px;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--muted);
  }
  .cvol input[type='range'] {
    accent-color: var(--green);
    min-width: 0;
  }
  .duck {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pct {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--muted);
  }
  .ic {
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    padding: 5px 8px;
    border-radius: 7px;
    line-height: 1;
  }
  .ic.big {
    font-size: 18px;
  }
  .ic:hover:not(:disabled) {
    color: var(--txt);
    background: rgba(47, 138, 102, 0.16);
  }
  .ic:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ic.on {
    color: var(--green);
  }
  .ic.muted {
    color: #ff8f8f;
  }
  .btn {
    border: 1px solid var(--line2);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
  }
  .btn.sm {
    padding: 6px 11px;
    font-size: 12px;
  }
  .btn:hover {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.16);
  }
  .btn.solid {
    background: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .btn.on {
    border-color: var(--green);
    color: var(--green);
  }
  .btn.panic {
    border-color: rgba(255, 90, 90, 0.6);
    color: #ff9d9d;
  }
  .btn.panic:hover {
    background: rgba(255, 90, 90, 0.16);
    border-color: #ff6b6b;
  }
  .board {
    border-radius: 10px;
    border: 1px solid transparent;
    padding: 4px;
    transition: border-color 0.12s;
  }
  .board.dropping {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.08);
  }
  .grouprow {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .chip.flt {
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
  }
  .chip.flt.on {
    color: var(--txt);
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.16);
  }
  .pads {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 8px;
  }
  .pad {
    position: relative;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 8px 6px;
    border-radius: 10px;
    border: 1px solid var(--line2);
    background: color-mix(in srgb, var(--pad) 30%, transparent);
    color: var(--txt);
    cursor: pointer;
    font-size: 12px;
    overflow: hidden;
  }
  .pad:hover {
    border-color: var(--pad);
    background: color-mix(in srgb, var(--pad) 45%, transparent);
  }
  .pad.flash {
    animation: padflash 0.65s ease-out;
  }
  @keyframes padflash {
    0% {
      box-shadow: 0 0 0 0 var(--pad);
      background: color-mix(in srgb, var(--pad) 80%, transparent);
    }
    100% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
  .pad kbd {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 9px;
    color: var(--faint);
  }
  .padlabel {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .muted {
    color: var(--muted);
  }
</style>
