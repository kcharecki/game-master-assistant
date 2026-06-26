<script lang="ts">
  import { audio } from './store.svelte';

  let pickPlaylist = $state(audio.playlists[0]?.id ?? '');

  function onTrackFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void audio.addTrack(pickPlaylist, file);
  }
  function onSfxFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void audio.addSfx(file);
  }
</script>

<div class="audio" data-no-drag>
  <section>
    <header>
      <select class="in" bind:value={pickPlaylist} aria-label="Scene playlist">
        {#each audio.playlists as p (p.id)}
          <option value={p.id}>{p.scene} ({p.tracks.length})</option>
        {/each}
      </select>
      <label class="btn sm">
        + Track<input type="file" accept="audio/*" onchange={onTrackFile} hidden />
      </label>
    </header>
    <div class="row">
      <button class="btn sm solid" onclick={() => audio.playScene(pickPlaylist)}>Play scene</button>
      <button class="btn sm" onclick={() => audio.stopScene()}>Stop</button>
      {#if audio.playingScene}<span class="now">on air</span>{/if}
    </div>
  </section>

  <section>
    <header>
      <strong class="sfxhdr">Soundboard</strong>
      <label class="btn sm">+ SFX<input type="file" accept="audio/*" onchange={onSfxFile} hidden /></label>
    </header>
    <div class="board">
      {#each audio.sfx as s (s.id)}
        <button class="chip" onclick={() => audio.playSfx(s.id)}>{s.label}</button>
      {:else}
        <span class="muted hint">Import clips to build a soundboard.</span>
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
</style>
