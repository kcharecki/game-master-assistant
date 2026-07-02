<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime } from './logic';
  import { t } from '../../lib/i18n';

  let pick = $state(audio.playlists[0]?.id ?? '');
  let ytUrl = $state('');
  // Inline-rename target ('' = none) keyed by an entity id.
  let editing = $state('');
  let editVal = $state('');
  // Drag-to-reorder cursor.
  let dragFrom = $state<number | null>(null);

  const playlist = $derived(audio.playlists.find((p) => p.id === pick));
  const tracks = $derived(playlist?.tracks ?? []);

  onMount(() => void audio.load());

  function startRename(id: string, current: string) {
    editing = id;
    editVal = current;
  }
  function commitScene() {
    if (playlist) audio.renamePlaylist(playlist.id, editVal);
    editing = '';
  }
  function commitTrack(trackId: string) {
    if (playlist) audio.renameTrack(playlist.id, trackId, editVal);
    editing = '';
  }
  function commitSfx(sfxId: string) {
    audio.renameSfx(sfxId, editVal);
    editing = '';
  }

  function addScene() {
    const pl = audio.addPlaylist('New scene');
    pick = pl.id;
    startRename(pl.id, pl.scene);
  }
  function delScene() {
    if (!playlist) return;
    audio.removePlaylist(playlist.id);
    pick = audio.playlists[0]?.id ?? '';
  }

  function importTracks(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    for (const f of input.files ?? []) if (f.type.startsWith('audio/')) void audio.addTrack(pick, f);
    input.value = '';
  }
  function importSfx(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    for (const f of input.files ?? []) if (f.type.startsWith('audio/')) void audio.addSfx(f);
    input.value = '';
  }
  function addYouTube() {
    if (audio.addYouTube(pick, ytUrl)) ytUrl = '';
  }

  // --- drag-to-reorder tracks (native DnD) ---
  function onDragStart(i: number) {
    dragFrom = i;
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }
  function onDrop(i: number) {
    if (dragFrom !== null) audio.moveTrackTo(pick, dragFrom, i);
    dragFrom = null;
  }
</script>

<div class="ed">
  <p class="hint">{t('audio.libraryHint')}</p>

  <!-- Scene rail -->
  <section>
    <header class="hdr">
      <strong>{t('audio.scene')}</strong>
      <button class="btn sm" onclick={addScene}>＋</button>
    </header>
    <div class="scenes">
      {#each audio.playlists as p (p.id)}
        <div class="scene" class:on={pick === p.id}>
          {#if editing === p.id}
            <input
              class="in"
              bind:value={editVal}
              onblur={commitScene}
              onkeydown={(e) => e.key === 'Enter' && commitScene()}
              aria-label={t('audio.sceneName')}
            />
          {:else}
            <button class="pick" onclick={() => (pick = p.id)} ondblclick={() => startRename(p.id, p.scene)} title={t('audio.renameHint')}>
              {p.scene} <span class="cnt">{p.tracks.length}</span>
            </button>
          {/if}
        </div>
      {/each}
    </div>
    {#if playlist}
      <div class="scenetools">
        <label class="gainlbl" title={t('audio.playlistGain')}>
          {t('audio.playlistGain')}
          <input type="range" min="0" max="1" step="0.05" value={playlist.gain ?? 1} oninput={(e) => audio.setPlaylistGain(pick, e.currentTarget.valueAsNumber)} />
        </label>
        <button class="btn sm" onclick={() => audio.shufflePlaylist(pick)} disabled={tracks.length < 2}>🔀 {t('audio.shuffle')}</button>
        <button class="btn sm danger" onclick={delScene}>🗑 {t('audio.deleteScene')}</button>
      </div>
    {/if}
  </section>

  <!-- Track list -->
  {#if playlist}
    <section>
      <header class="hdr"><strong>{t('audio.tracks')}</strong></header>
      {#if tracks.length}
        <ul class="tracks">
          {#each tracks as tr, i (tr.id)}
            <li
              draggable="true"
              ondragstart={() => onDragStart(i)}
              ondragover={onDragOver}
              ondrop={() => onDrop(i)}
              class:drag={dragFrom === i}
            >
              <span class="grip" aria-hidden="true">⠿</span>
              <span class="idx">{i + 1}</span>
              {#if tr.youtubeId}<span class="badge">YT</span>{/if}
              {#if editing === tr.id}
                <input class="in" bind:value={editVal} onblur={() => commitTrack(tr.id)} onkeydown={(e) => e.key === 'Enter' && commitTrack(tr.id)} aria-label={t('audio.rename')} />
              {:else}
                <span class="lbl" ondblclick={() => startRename(tr.id, tr.label)} title={t('audio.renameHint')} role="button" tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && startRename(tr.id, tr.label)}>{tr.label}</span>
              {/if}
              {#if tr.duration}<span class="dur">{formatTime(tr.duration)}</span>{/if}
              <input class="gain" type="range" min="0" max="1" step="0.05" value={tr.gain ?? 1} oninput={(e) => audio.setTrackGain(pick, tr.id, e.currentTarget.valueAsNumber)} title={t('audio.trackGain')} />
              <button class="ic" onclick={() => audio.moveTrack(pick, i, -1)} disabled={i === 0} aria-label={t('audio.moveUp')}>▲</button>
              <button class="ic" onclick={() => audio.moveTrack(pick, i, 1)} disabled={i === tracks.length - 1} aria-label={t('audio.moveDown')}>▼</button>
              {#if tr.assetId}<button class="ic" onpointerdown={() => audio.audition(tr.assetId)} onpointerup={() => audio.stopAudition()} aria-label={t('audio.audition')} title={t('audio.audition')}>🎧</button>{/if}
              <button class="ic del" onclick={() => audio.removeTrack(pick, tr.id)} aria-label={t('audio.delete')}>✕</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">{t('audio.noTracks')}</p>
      {/if}

      <div class="addrow">
        <label class="btn sm">{t('audio.addTrack')}<input type="file" accept="audio/*" multiple hidden onchange={importTracks} /></label>
        <label class="ytopt"><input type="checkbox" bind:checked={audio.ytAudioOnly} /> {t('audio.audioOnly')}</label>
      </div>
      <div class="ytrow">
        <input class="in" type="url" placeholder={t('audio.ytUrlPlaceholder')} bind:value={ytUrl} aria-label={t('audio.ytUrl')} />
        <button class="btn sm" onclick={addYouTube} disabled={!ytUrl.trim()}>{t('audio.addYouTube')}</button>
      </div>
    </section>
  {/if}

  <!-- Soundboard editor -->
  <section>
    <header class="hdr">
      <strong>{t('audio.soundboard')}</strong>
      <label class="btn sm">{t('audio.addSfx')}<input type="file" accept="audio/*" multiple hidden onchange={importSfx} /></label>
    </header>
    {#if audio.sfx.length}
      <ul class="sfxlist">
        {#each audio.sfx as s (s.id)}
          <li>
            {#if editing === s.id}
              <input class="in" bind:value={editVal} onblur={() => commitSfx(s.id)} onkeydown={(e) => e.key === 'Enter' && commitSfx(s.id)} aria-label={t('audio.rename')} />
            {:else}
              <span class="lbl" ondblclick={() => startRename(s.id, s.label)} title={t('audio.renameHint')} role="button" tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && startRename(s.id, s.label)}>{s.label}</span>
            {/if}
            <input class="grp" placeholder={t('audio.group')} value={s.group ?? ''} onchange={(e) => audio.setSfxGroup(s.id, e.currentTarget.value)} aria-label={t('audio.group')} />
            <input class="gain" type="range" min="0" max="1" step="0.05" value={s.gain ?? 1} oninput={(e) => audio.setSfxGain(s.id, e.currentTarget.valueAsNumber)} title={t('audio.sfxGain')} />
            <button class="ic" onpointerdown={() => audio.audition(s.assetId)} onpointerup={() => audio.stopAudition()} aria-label={t('audio.audition')} title={t('audio.audition')}>🎧</button>
            <button class="ic del" onclick={() => audio.removeSfx(s.id)} aria-label={t('audio.delete')}>✕</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{t('audio.soundboardHint')}</p>
    {/if}
  </section>
</div>

<style>
  .ed {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px 24px;
    max-width: 780px;
    color: var(--txt);
    font-size: 13px;
  }
  .hint {
    color: var(--muted);
    margin: 0;
  }
  .hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .scenes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .scene .pick {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .scene.on .pick {
    color: var(--txt);
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.16);
  }
  .cnt {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .scenetools {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .gainlbl {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
  }
  input[type='range'] {
    accent-color: var(--green);
  }
  .tracks,
  .sfxlist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tracks li,
  .sfxlist li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid transparent;
  }
  .tracks li.drag {
    opacity: 0.5;
    border-color: var(--green-dim);
  }
  .grip {
    cursor: grab;
    color: var(--faint);
  }
  .idx {
    width: 18px;
    text-align: right;
    color: var(--faint);
    font-variant-numeric: tabular-nums;
  }
  .badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(255, 90, 90, 0.2);
    color: #ff9d9d;
  }
  .lbl {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .dur {
    color: var(--faint);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }
  .gain {
    width: 72px;
  }
  .grp {
    width: 88px;
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 11px;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .ic {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 12px;
    padding: 3px 5px;
    border-radius: 6px;
  }
  .ic:hover:not(:disabled) {
    color: var(--txt);
    background: rgba(47, 138, 102, 0.16);
  }
  .ic:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ic.del:hover {
    color: #ff6b6b;
  }
  .addrow,
  .ytrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .ytopt {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 4px;
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
    padding: 5px 10px;
    font-size: 12px;
  }
  .btn:hover {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.16);
  }
  .btn.danger:hover {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }
  .muted {
    color: var(--muted);
  }
</style>
