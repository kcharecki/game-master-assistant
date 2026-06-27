<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime } from './logic';
  import { t } from '../../lib/i18n';

  let pickPlaylist = $state(audio.playlists[0]?.id ?? '');
  let ytUrl = $state('');
  const tracks = $derived(audio.playlists.find((p) => p.id === pickPlaylist)?.tracks ?? []);

  // Load saved playlists/soundboard, then subscribe to ambient playback status
  // from the broadcast tab; clean up the subscription on unmount.
  onMount(() => {
    void audio.load();
    return audio.subscribeStatus();
  });

  function onTrackFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void audio.addTrack(pickPlaylist, file);
  }
  function onSfxFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void audio.addSfx(file);
  }
  function onAddYouTube() {
    if (audio.addYouTube(pickPlaylist, ytUrl)) ytUrl = '';
  }
  function onSeek(e: Event) {
    audio.seek((e.currentTarget as HTMLInputElement).valueAsNumber);
  }
</script>

<div class="audio" data-no-drag>
  <section>
    <header>
      <select class="in" bind:value={pickPlaylist} aria-label={t('audio.scenePlaylist')}>
        {#each audio.playlists as p (p.id)}
          <option value={p.id}>{p.scene} ({p.tracks.length})</option>
        {/each}
      </select>
      <label class="btn sm">
        {t('audio.addTrack')}<input type="file" accept="audio/*" onchange={onTrackFile} hidden />
      </label>
    </header>
    <div class="row">
      <button class="btn sm solid" onclick={() => audio.playScene(pickPlaylist)}>{t('audio.playScene')}</button>
      <button class="btn sm" onclick={() => audio.stopScene()}>{t('audio.stop')}</button>
      {#if audio.playingScene}<span class="now">{t('audio.onAir')}</span>{/if}
    </div>

    {#if tracks.length}
      <ul class="tracks">
        {#each tracks as tr (tr.id)}
          <li>
            {#if tr.youtubeId}<span class="ytbadge">▶ YT</span>{/if}
            <span class="tlabel">{tr.label}</span>
          </li>
        {/each}
      </ul>
    {/if}

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
    <label class="ytopt">
      <input type="checkbox" bind:checked={audio.ytAudioOnly} />
      {t('audio.audioOnly')}
    </label>

    <!-- Ambient transport. Fine seek is native-audio only; for YouTube the slider
         is disabled and Rewind re-mounts the iframe (YT scrubbing needs the JS API). -->
    {#if audio.playingScene}
      <div class="transport">
        <button class="btn sm" onclick={() => audio.rewind()} aria-label={t('audio.rewind')}>⏪</button>
        <input
          type="range"
          class="seek"
          min="0"
          max={audio.duration || 0}
          step="0.1"
          value={audio.position}
          oninput={onSeek}
          disabled={audio.playingYouTube || audio.duration <= 0}
          aria-label={t('audio.seek')}
        />
        <span class="time">
          {#if audio.playingYouTube}
            ▶ YT
          {:else}
            {formatTime(audio.position)} / {formatTime(audio.duration)}
          {/if}
        </span>
      </div>
    {/if}
  </section>

  <section>
    <header>
      <strong class="sfxhdr">{t('audio.soundboard')}</strong>
      <label class="btn sm">{t('audio.addSfx')}<input type="file" accept="audio/*" onchange={onSfxFile} hidden /></label>
    </header>
    <div class="board">
      {#each audio.sfx as s (s.id)}
        <button class="chip" onclick={() => audio.playSfx(s.id)}>{s.label}</button>
      {:else}
        <span class="muted hint">{t('audio.soundboardHint')}</span>
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
  .sfxhdr {
    flex: 1;
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid var(--line2);
    background: rgba(47, 138, 102, 0.1);
    color: var(--txt);
    cursor: pointer;
  }
  .chip:hover {
    background: rgba(47, 138, 102, 0.2);
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
  .btn.sm.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .btn.sm input {
    display: none;
  }
  .hint {
    font-size: 12px;
  }
  .ytrow {
    margin-top: 8px;
  }
  .ytopt {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
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
  .tracks {
    list-style: none;
    margin: 8px 0 0;
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
  }
  .tlabel {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
