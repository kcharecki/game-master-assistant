<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime } from './logic';
  import { t } from '../../lib/i18n';

  let pickPlaylist = $state(audio.playlists[0]?.id ?? '');
  let ytUrl = $state('');
  let renaming = $state(false);
  let sceneName = $state('');
  let sfxGroup = $state(''); // active soundboard group filter ('' = all)
  let dropping = $state(false);

  const playlist = $derived(audio.playlists.find((p) => p.id === pickPlaylist));
  const tracks = $derived(playlist?.tracks ?? []);
  const onAir = $derived(audio.playingScene === pickPlaylist);
  const groups = $derived(audio.sfxGroups);
  const shownSfx = $derived(
    sfxGroup ? audio.sfx.filter((s) => (s.group ?? '') === sfxGroup) : audio.sfx
  );

  // Load saved data, subscribe to broadcast status, and bind number-key hotkeys
  // (1-9) to the first nine soundboard clips. Clean all up on unmount.
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
        // Index the *visible* soundboard so hotkeys match the on-screen badges
        // even when a group filter is active.
        const s = shownSfx[Number(e.key) - 1];
        if (s) audio.playSfx(s.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offStatus();
      window.removeEventListener('keydown', onKey);
    };
  });

  function importFiles(files: FileList | null | undefined, kind: 'track' | 'sfx') {
    for (const f of files ?? []) {
      if (!f.type.startsWith('audio/')) continue;
      if (kind === 'track') void audio.addTrack(pickPlaylist, f);
      else void audio.addSfx(f, sfxGroup || undefined);
    }
  }
  function onTrackFile(e: Event) {
    importFiles((e.currentTarget as HTMLInputElement).files, 'track');
    (e.currentTarget as HTMLInputElement).value = '';
  }
  function onSfxFile(e: Event) {
    importFiles((e.currentTarget as HTMLInputElement).files, 'sfx');
    (e.currentTarget as HTMLInputElement).value = '';
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dropping = false;
    importFiles(e.dataTransfer?.files, 'track');
  }
  function onAddYouTube() {
    if (audio.addYouTube(pickPlaylist, ytUrl)) ytUrl = '';
  }
  // While the user drags the seek thumb, hold `seeking` so incoming audioStatus
  // reports don't yank the thumb back to the live position mid-drag.
  let seeking = $state(false);
  let seekPos = $state(0);
  const seekValue = $derived(seeking ? seekPos : audio.position);
  function onSeekInput(e: Event) {
    seekPos = (e.currentTarget as HTMLInputElement).valueAsNumber;
  }
  function onSeekStart() {
    seekPos = audio.position;
    seeking = true;
  }
  function onSeekCommit() {
    if (!seeking) return;
    seeking = false;
    audio.seek(seekPos);
  }
  function newScene() {
    const pl = audio.addPlaylist('New scene');
    pickPlaylist = pl.id;
    sceneName = pl.scene;
    renaming = true;
  }
  function commitRename() {
    audio.renamePlaylist(pickPlaylist, sceneName);
    renaming = false;
  }
  function delScene() {
    audio.removePlaylist(pickPlaylist);
    pickPlaylist = audio.playlists[0]?.id ?? '';
  }
  async function toggleRecord() {
    if (audio.recording) audio.stopRecording();
    else await audio.startRecording();
  }
</script>

<div class="audio" data-no-drag>
  <!-- Mixer: master + per-channel volume. -->
  <section class="mixer">
    <label class="vol">
      <span>{t('audio.vol.master')}</span>
      <input type="range" min="0" max="1" step="0.01" value={audio.masterVol} oninput={(e) => audio.setMasterVol(e.currentTarget.valueAsNumber)} />
      <span class="pct">{Math.round(audio.masterVol * 100)}</span>
    </label>
    <label class="vol">
      <span>{t('audio.vol.ambient')}</span>
      <input type="range" min="0" max="1" step="0.01" value={audio.ambientVol} oninput={(e) => audio.setAmbientVol(e.currentTarget.valueAsNumber)} />
      <span class="pct">{Math.round(audio.ambientVol * 100)}</span>
    </label>
    <label class="vol">
      <span>{t('audio.vol.sfx')}</span>
      <input type="range" min="0" max="1" step="0.01" value={audio.sfxVol} oninput={(e) => audio.setSfxVol(e.currentTarget.valueAsNumber)} />
      <span class="pct">{Math.round(audio.sfxVol * 100)}</span>
    </label>
  </section>

  <section>
    <header>
      {#if renaming}
        <input
          class="in"
          bind:value={sceneName}
          onblur={commitRename}
          onkeydown={(e) => e.key === 'Enter' && commitRename()}
          aria-label={t('audio.sceneName')}
        />
      {:else}
        <select class="in" bind:value={pickPlaylist} aria-label={t('audio.scenePlaylist')}>
          {#each audio.playlists as p (p.id)}
            <option value={p.id}>{p.scene} ({p.tracks.length})</option>
          {/each}
        </select>
        <button
          class="btn sm"
          title={t('audio.renameScene')}
          onclick={() => {
            sceneName = playlist?.scene ?? '';
            renaming = true;
          }}>✎</button
        >
      {/if}
      <button class="btn sm" title={t('audio.newScene')} onclick={newScene}>＋</button>
      <button class="btn sm" title={t('audio.deleteScene')} onclick={delScene}>🗑</button>
    </header>

    <!-- Transport -->
    <div class="row">
      <button class="btn sm solid" onclick={() => audio.playScene(pickPlaylist)}>{t('audio.playScene')}</button>
      <button class="btn sm" onclick={() => audio.prev()} disabled={!onAir} aria-label={t('audio.prev')}>⏮</button>
      <button class="btn sm" onclick={() => audio.togglePause()} disabled={!onAir}>
        {audio.paused ? '▶' : '⏸'}
      </button>
      <button class="btn sm" onclick={() => audio.next()} disabled={!onAir} aria-label={t('audio.next')}>⏭</button>
      <button class="btn sm" onclick={() => audio.stopScene()} disabled={!onAir}>{t('audio.stop')}</button>
      {#if onAir}<span class="now">{t('audio.onAir')}</span>{/if}
    </div>

    <!-- Loop + crossfade options -->
    <div class="row opts">
      <button class="btn sm" class:on={audio.loopList} onclick={() => audio.toggleLoopList()}>🔁 {t('audio.loopList')}</button>
      <button class="btn sm" class:on={audio.loopTrack} onclick={() => audio.toggleLoopTrack()}>🔂 {t('audio.loopTrack')}</button>
      <label class="xf">
        {t('audio.crossfade')}
        <input
          type="range"
          min="0"
          max="6000"
          step="250"
          value={audio.crossfadeMs}
          oninput={(e) => audio.setCrossfade(e.currentTarget.valueAsNumber)}
        />
        <span class="pct">{(audio.crossfadeMs / 1000).toFixed(1)}s</span>
      </label>
    </div>

    <!-- Track list: now-playing highlight, gain, reorder, delete. -->
    <div
      class="droptarget"
      class:dropping
      ondragover={(e) => {
        e.preventDefault();
        dropping = true;
      }}
      ondragleave={() => (dropping = false)}
      ondrop={onDrop}
      role="list"
    >
      {#if tracks.length}
        <ul class="tracks">
          {#each tracks as tr, i (tr.id)}
            <li class:cur={onAir && audio.trackIndex === i}>
              <span class="idx">{i + 1}</span>
              {#if tr.youtubeId}<span class="ytbadge">▶ YT</span>{/if}
              <span class="tlabel">{tr.label}</span>
              <input
                class="tgain"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={tr.gain ?? 1}
                oninput={(e) => audio.setTrackGain(pickPlaylist, tr.id, e.currentTarget.valueAsNumber)}
                title={t('audio.trackGain')}
              />
              <button class="ic" onclick={() => audio.moveTrack(pickPlaylist, i, -1)} disabled={i === 0} aria-label={t('audio.moveUp')}>▲</button>
              <button class="ic" onclick={() => audio.moveTrack(pickPlaylist, i, 1)} disabled={i === tracks.length - 1} aria-label={t('audio.moveDown')}>▼</button>
              <button class="ic" onclick={() => audio.removeTrack(pickPlaylist, tr.id)} aria-label={t('audio.delete')}>✕</button>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="muted emptyhint">{t('audio.dropHint')}</span>
      {/if}
    </div>

    <div class="row addrow">
      <label class="btn sm">
        {t('audio.addTrack')}<input type="file" accept="audio/*" multiple onchange={onTrackFile} hidden />
      </label>
      <label class="ytopt">
        <input type="checkbox" bind:checked={audio.ytAudioOnly} />
        {t('audio.audioOnly')}
      </label>
    </div>

    <div class="row ytrow">
      <input
        class="in"
        type="url"
        placeholder={t('audio.ytUrlPlaceholder')}
        bind:value={ytUrl}
        aria-label={t('audio.ytUrl')}
      />
      <button class="btn sm" onclick={onAddYouTube} disabled={!ytUrl.trim()}>{t('audio.addYouTube')}</button>
    </div>

    <!-- Ambient seek. Native-audio only; disabled for YouTube tracks. -->
    {#if onAir}
      <div class="transport">
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
        <span class="time">
          {#if audio.playingYouTube}
            ▶ YT {audio.trackIndex + 1}/{audio.trackCount}
          {:else}
            {formatTime(audio.position)} / {formatTime(audio.duration)}
          {/if}
        </span>
      </div>
    {/if}
  </section>

  <!-- Soundboard: groups, hotkeys (1-9), record, per-clip delete. -->
  <section>
    <header>
      <strong class="sfxhdr">{t('audio.soundboard')}</strong>
      <button class="btn sm" class:rec={audio.recording} onclick={toggleRecord}>
        {audio.recording ? `⏺ ${t('audio.stopRec')}` : `🎙 ${t('audio.record')}`}
      </button>
      <label class="btn sm">{t('audio.addSfx')}<input type="file" accept="audio/*" multiple onchange={onSfxFile} hidden /></label>
    </header>

    {#if groups.length > 1}
      <div class="row groups">
        <button class="chip flt" class:on={sfxGroup === ''} onclick={() => (sfxGroup = '')}>{t('audio.allGroups')}</button>
        {#each groups as g (g)}
          {#if g}
            <button class="chip flt" class:on={sfxGroup === g} onclick={() => (sfxGroup = g)}>{g}</button>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="board">
      {#each shownSfx as s, i (s.id)}
        <span class="sfxitem">
          <button class="chip" onclick={() => audio.playSfx(s.id)}>
            {#if i < 9}<kbd>{i + 1}</kbd>{/if}{s.label}
          </button>
          <button class="ic del" onclick={() => audio.removeSfx(s.id)} aria-label={t('audio.delete')}>✕</button>
        </span>
      {:else}
        <span class="muted emptyhint">{t('audio.soundboardHint')}</span>
      {/each}
    </div>
  </section>
</div>

<style>
  .audio {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: 13px;
    color: var(--txt);
  }
  header {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .now {
    color: var(--green);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
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
  .mixer {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .vol {
    display: grid;
    grid-template-columns: 64px 1fr 28px;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--muted);
    text-transform: capitalize;
  }
  .vol input,
  .xf input {
    accent-color: var(--green);
    min-width: 0;
  }
  .pct {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--muted);
  }
  .opts {
    margin-top: 8px;
  }
  .xf {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 120px;
    font-size: 11px;
    color: var(--muted);
  }
  .xf input {
    flex: 1;
  }
  .sfxhdr {
    flex: 1;
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .sfxitem {
    display: inline-flex;
    align-items: center;
  }
  .chip {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid var(--line2);
    background: rgba(47, 138, 102, 0.1);
    color: var(--txt);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .chip:hover {
    background: rgba(47, 138, 102, 0.2);
  }
  .chip kbd {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--line2);
    color: var(--muted);
  }
  .chip.flt.on {
    background: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .groups {
    margin-bottom: 6px;
  }
  .btn.sm {
    padding: 5px 10px;
    font-size: 12px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.sm.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .btn.sm.on {
    border-color: var(--green);
    color: var(--green);
  }
  .btn.sm.rec {
    border-color: #ff5a5a;
    color: #ff8a8a;
  }
  .btn.sm input {
    display: none;
  }
  .emptyhint {
    font-size: 12px;
  }
  .addrow {
    margin-top: 8px;
  }
  .ytrow {
    margin-top: 8px;
  }
  .ytopt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .seek {
    flex: 1;
    min-width: 0;
    accent-color: var(--green);
  }
  .seek:disabled {
    opacity: 0.4;
  }
  .time {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .droptarget {
    margin-top: 8px;
    border: 1px dashed transparent;
    border-radius: 8px;
  }
  .droptarget.dropping {
    border-color: var(--green);
    background: rgba(47, 138, 102, 0.08);
  }
  .tracks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tracks li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    padding: 2px 4px;
    border-radius: 6px;
  }
  .tracks li.cur {
    background: rgba(47, 138, 102, 0.16);
    color: var(--txt);
  }
  .idx {
    flex: none;
    width: 14px;
    text-align: right;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .tlabel {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tgain {
    flex: none;
    width: 52px;
    accent-color: var(--green);
  }
  .ic {
    flex: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 5px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--muted);
    font-size: 10px;
    cursor: pointer;
  }
  .ic:hover {
    color: var(--txt);
  }
  .ic:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ic.del {
    margin-left: 2px;
  }
  .ytbadge {
    flex: none;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 999px;
    color: #06120c;
    background: var(--green-dim);
    font-weight: 700;
  }
</style>
