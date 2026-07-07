<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime, type RepeatMode } from './logic';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';

  let pick = $state(audio.scenes[0]?.id ?? '');
  let ytUrl = $state('');
  let editing = $state(''); // inline-rename target ('' = none)
  let editVal = $state('');
  let dragFrom = $state<number | null>(null);
  let now = $state(Date.now());

  const scene = $derived(audio.scenes.find((p) => p.id === pick));
  const tracks = $derived(scene?.tracks ?? []);
  const onAir = $derived(audio.scenes.find((p) => p.id === audio.playingScene));
  const hero = $derived(onAir ?? scene);
  const heroTrack = $derived(onAir?.tracks[audio.trackIndex]);
  const heroInitial = $derived((hero?.name ?? '·').trim().charAt(0).toUpperCase() || '·');
  const output = $derived(
    !audio.playingScene ? 'idle' : now - audio.lastStatusAt < 3000 ? 'live' : 'closed'
  );
  const pinOrder = $derived(audio.pinnedSfx.map((s) => s.id));
  // group '' (ungrouped) sorts last; named groups keep insertion order
  const groups = $derived(audio.sfxGroups.slice().sort((a, b) => (a === '' ? 1 : b === '' ? -1 : 0)));

  const FADES = [1500, 3000, 0];
  const fadeLabel = $derived(
    audio.crossfadeMs === 0 ? t('audio.repeat.off') : `${(audio.crossfadeMs / 1000).toFixed(1)}s`
  );
  const repeatLabel = $derived(
    audio.repeat === 'track'
      ? t('audio.repeat.track')
      : audio.repeat === 'scene'
        ? t('audio.repeat.scene')
        : t('audio.repeat.off')
  );

  const bars = Array.from({ length: 72 }, (_, i) =>
    0.28 + 0.72 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.5))
  );
  const progress = $derived(audio.duration > 0 ? audio.position / audio.duration : 0);

  onMount(() => {
    void audio.load();
    const offStatus = audio.subscribeStatus();
    const clock = setInterval(() => (now = Date.now()), 1000);
    return () => {
      offStatus();
      clearInterval(clock);
    };
  });

  function startRename(id: string, current: string) {
    editing = id;
    editVal = current;
  }
  function commitScene() {
    if (scene) audio.renameScene(scene.id, editVal);
    editing = '';
  }
  function commitTrack(trackId: string) {
    if (scene) audio.renameTrack(scene.id, trackId, editVal);
    editing = '';
  }
  function commitSfx(sfxId: string) {
    audio.renameSfx(sfxId, editVal);
    editing = '';
  }

  function addScene() {
    const sc = audio.addScene('New scene');
    pick = sc.id;
    startRename(sc.id, sc.name);
  }
  function delScene() {
    if (!scene) return;
    audio.removeScene(scene.id);
    pick = audio.scenes[0]?.id ?? '';
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
  function toggleRec() {
    if (audio.recording) audio.stopRecording();
    else void audio.startRecording();
  }

  // transport
  function togglePlay() {
    if (audio.playingScene) audio.togglePause();
    else if (tracks.length) audio.playScene(pick);
  }
  function cycleRepeat() {
    const order: RepeatMode[] = ['off', 'scene', 'track'];
    audio.setRepeat(order[(order.indexOf(audio.repeat) + 1) % order.length]);
  }
  function cycleFade() {
    audio.setCrossfade(FADES[(FADES.indexOf(audio.crossfadeMs) + 1 + FADES.length) % FADES.length]);
  }
  function onWaveClick(e: MouseEvent) {
    if (audio.playingYouTube || audio.duration <= 0) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    audio.seek(((e.clientX - r.left) / r.width) * audio.duration);
  }
  function onWaveKey(e: KeyboardEvent) {
    if (audio.playingYouTube || audio.duration <= 0) return;
    if (e.key === 'ArrowLeft') audio.seek(audio.position - 5);
    else if (e.key === 'ArrowRight') audio.seek(audio.position + 5);
  }

  // drag-to-reorder tracks
  function onDragStart(i: number) {
    dragFrom = i;
  }
  function onDrop(i: number) {
    if (dragFrom !== null) audio.moveTrackTo(pick, dragFrom, i);
    dragFrom = null;
  }

  const groupLabel = (g: string) => (g ? g : t('audio.ungrouped'));
  const hotkeyOf = (id: string) => {
    const n = pinOrder.indexOf(id);
    return n >= 0 && n < 9 ? String(n + 1) : '';
  };
</script>

<div class="aude">
  <!-- header: on-air + broadcast + panic -->
  <header class="aude-top {output}">
    <span class="aude-dot"></span>
    <span class="aude-onair">{t('audio.onAir').toUpperCase()}{hero ? ` · ${hero.name}` : ''}</span>
    <span class="aude-spacer"></span>
    <span class="aude-conn">{output === 'closed' ? t('audio.broadcastShut') : output === 'idle' ? '' : t('audio.broadcastOpen')}</span>
    <button class="aude-panic" onclick={() => audio.panic()} title={t('audio.panicTitle')}>◼ {t('audio.panic')}</button>
  </header>

  <div class="aude-grid">
    <!-- ── A · Scenes rail ─────────────────────────────────── -->
    <aside class="aude-rail">
      <div class="aude-caphead">
        <span class="aude-cap">{t('audio.scenesLabel')}</span>
        <button class="aude-mini" onclick={addScene} aria-label={t('audio.newScene')} title={t('audio.newScene')}><Icon name="plus" size={13} /></button>
      </div>
      <ul class="aude-scenes">
        {#each audio.scenes as p (p.id)}
          <li class="aude-scard" class:on={pick === p.id} class:live={audio.playingScene === p.id}>
            {#if editing === p.id}
              <input class="aude-in" bind:value={editVal} onblur={commitScene} onkeydown={(e) => e.key === 'Enter' && commitScene()} aria-label={t('audio.sceneName')} />
            {:else}
              <button class="aude-spick" onclick={() => (pick = p.id)} ondblclick={() => startRename(p.id, p.name)} title={t('audio.renameHint')}>
                <span class="aude-sdot"></span>
                <span class="aude-sname">{p.name}</span>
                <span class="aude-smeta">{p.tracks.length} {t('audio.trackCount')}{audio.playingScene === p.id ? ` · ${t('audio.playingLabel')}` : ''}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if scene}
        <div class="aude-svol">
          <div class="aude-cap">{t('audio.sceneDefaultVol')}</div>
          <input type="range" min="0" max="1" step="0.05" value={scene.gain ?? 1} oninput={(e) => audio.setSceneGain(pick, e.currentTarget.valueAsNumber)} aria-label={t('audio.playlistGain')} />
          <p class="aude-hint">{t('audio.sceneDefaultVolHint')}</p>
          <button class="aude-btn del" onclick={delScene}><Icon name="trash" size={12} /> {t('audio.deleteScene')}</button>
        </div>
      {/if}
    </aside>

    <!-- ── B/C/D · Now-playing + tracks ────────────────────── -->
    <section class="aude-main">
      <div class="aude-hero">
        <div class="aude-avatar">{heroInitial}</div>
        <div class="aude-hinfo">
          <div class="aude-htitle">{hero?.name ?? t('audio.nothingPlaying')}</div>
          <div class="aude-hsub">{audio.playingScene ? (heroTrack?.label ?? '—') : t('audio.nothingPlaying')}</div>
        </div>
        <div class="aude-wave" class:dead={!audio.playingScene} onclick={onWaveClick} onkeydown={onWaveKey} role="slider" tabindex="0" aria-label={t('audio.seek')} aria-valuenow={Math.round(audio.position)} aria-valuemax={Math.round(audio.duration)}>
          {#each bars as h, i (i)}
            <span class="aude-bar" class:lit={i / bars.length <= progress} style="height:{Math.round(h * 100)}%"></span>
          {/each}
        </div>
      </div>

      <div class="aude-transport">
        <button class="aude-ic" onclick={() => audio.prev()} disabled={!audio.playingScene} aria-label={t('audio.prev')}><Icon name="prev" /></button>
        <button class="aude-play" onclick={togglePlay} disabled={!audio.playingScene && !tracks.length} aria-label={audio.paused || !audio.playingScene ? t('audio.play') : t('audio.pause')}><Icon name={audio.playingScene && !audio.paused ? 'pause' : 'play'} size={18} /></button>
        <button class="aude-ic" onclick={() => audio.next()} disabled={!audio.playingScene} aria-label={t('audio.next')}><Icon name="next" /></button>
        <span class="aude-clock">
          {formatTime(audio.position)} / {formatTime(audio.duration)}
          {#if audio.playingScene}<span class="aude-idx">· {audio.trackIndex + 1} / {audio.trackCount}</span>{/if}
        </span>
        <span class="aude-tspacer"></span>
        <button class="aude-tbtn" onclick={cycleRepeat} title={t('audio.repeat')}>↺ {repeatLabel}</button>
        <button class="aude-tbtn" onclick={() => audio.shuffleScene(pick)} disabled={tracks.length < 2}>🔀 {t('audio.shuffle')}</button>
        <button class="aude-tbtn" onclick={cycleFade} title={t('audio.crossfade')}>✕ {fadeLabel}</button>
      </div>

      <!-- tracks -->
      <div class="aude-caphead">
        <span class="aude-cap">{t('audio.tracksReorder')}</span>
        <span class="aude-tacts">
          <label class="aude-btn">＋ {t('audio.importFiles')}<input type="file" accept="audio/*" multiple hidden onchange={importTracks} /></label>
        </span>
      </div>
      {#if tracks.length}
        <ul class="aude-tracks">
          {#each tracks as tr, i (tr.id)}
            <li
              draggable="true"
              ondragstart={() => onDragStart(i)}
              ondragover={(e) => e.preventDefault()}
              ondrop={() => onDrop(i)}
              class:drag={dragFrom === i}
              class:playing={audio.playingScene === pick && i === audio.trackIndex}
            >
              <span class="aude-grip" aria-hidden="true">⁝⁝</span>
              <button class="aude-pf" onclick={() => audio.playSceneAt(pick, i)} aria-label={t('audio.playFrom')} title={t('audio.playFrom')}><Icon name={audio.playingScene === pick && i === audio.trackIndex && !audio.paused ? 'pause' : 'play'} size={12} /></button>
              {#if editing === tr.id}
                <input class="aude-in" bind:value={editVal} onblur={() => commitTrack(tr.id)} onkeydown={(e) => e.key === 'Enter' && commitTrack(tr.id)} aria-label={t('audio.rename')} />
              {:else}
                <span class="aude-lbl" ondblclick={() => startRename(tr.id, tr.label)} title={t('audio.renameHint')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && startRename(tr.id, tr.label)}>{tr.label}</span>
              {/if}
              <span class="aude-badge" class:yt={!!tr.youtubeId}>{tr.youtubeId ? 'YT' : 'FILE'}</span>
              <button class="aude-ic sm star" class:on={tr.pinned} onclick={() => audio.togglePinTrack(pick, tr.id)} aria-label={tr.pinned ? t('audio.unpinTrack') : t('audio.pinTrack')} title={tr.pinned ? t('audio.unpinTrack') : t('audio.pinTrack')}>{tr.pinned ? '★' : '☆'}</button>
              <input class="aude-gain" type="range" min="0" max="1" step="0.05" value={tr.gain ?? 1} oninput={(e) => audio.setTrackGain(pick, tr.id, e.currentTarget.valueAsNumber)} title={t('audio.trackGain')} aria-label={t('audio.trackGain')} />
              {#if tr.duration}<span class="aude-dur">{formatTime(tr.duration)}</span>{:else}<span class="aude-dur">—</span>{/if}
              {#if tr.assetId}<button class="aude-ic sm" onpointerdown={() => audio.audition(tr.assetId)} onpointerup={() => audio.stopAudition()} aria-label={t('audio.audition')} title={t('audio.auditionLabel')}>🎧</button>{/if}
              <button class="aude-ic sm del" onclick={() => audio.removeTrack(pick, tr.id)} aria-label={t('audio.delete')} title={t('audio.delete')}><Icon name="trash" size={13} /></button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="aude-hint">{t('audio.noTracks')}</p>
      {/if}
      <div class="aude-drop">
        <span>{t('audio.dropZone')}</span>
        <label class="aude-ytopt"><input type="checkbox" bind:checked={audio.ytAudioOnly} /> {t('audio.audioOnly')}</label>
      </div>
      <div class="aude-ytrow">
        <input class="aude-in" type="url" placeholder={t('audio.ytUrlPlaceholder')} bind:value={ytUrl} aria-label={t('audio.ytUrl')} />
        <button class="aude-btn" onclick={addYouTube} disabled={!ytUrl.trim()}>▷ {t('audio.addYouTube')}</button>
      </div>
    </section>

    <!-- ── E/F · Soundboard + Mixer ────────────────────────── -->
    <aside class="aude-right">
      <div class="aude-caphead">
        <span class="aude-cap">{t('audio.soundboard')}</span>
        <span class="aude-tacts">
          <button class="aude-btn" class:rec={audio.recording} onclick={toggleRec}>● {audio.recording ? t('audio.stopRec') : t('audio.rec')}</button>
          <label class="aude-btn">＋ {t('audio.import')}<input type="file" accept="audio/*" multiple hidden onchange={importSfx} /></label>
        </span>
      </div>

      {#if audio.sfx.length}
        {#each groups as g (g)}
          <div class="aude-grouplbl">{groupLabel(g)}</div>
          <div class="aude-board">
            {#each audio.sfx.filter((s) => (s.group ?? '') === g) as s (s.id)}
              <div class="aude-tile" class:pinned={s.pinned}>
                <div class="aude-tilehd">
                  <button class="aude-star" class:on={s.pinned} onclick={() => audio.togglePin(s.id)} title={s.pinned ? t('audio.unpin') : t('audio.pin')} aria-label={s.pinned ? t('audio.unpin') : t('audio.pin')}>{s.pinned ? '★' : '☆'}</button>
                  <span class="aude-hk">{hotkeyOf(s.id) || '—'}</span>
                  <span class="aude-tsp"></span>
                  <button class="aude-ic sm" onpointerdown={() => audio.audition(s.assetId)} onpointerup={() => audio.stopAudition()} aria-label={t('audio.audition')} title={t('audio.auditionLabel')}>🎧</button>
                  <button class="aude-ic sm del" onclick={() => audio.removeSfx(s.id)} aria-label={t('audio.delete')} title={t('audio.delete')}><Icon name="trash" size={12} /></button>
                </div>
                {#if editing === s.id}
                  <input class="aude-in" bind:value={editVal} onblur={() => commitSfx(s.id)} onkeydown={(e) => e.key === 'Enter' && commitSfx(s.id)} aria-label={t('audio.rename')} />
                {:else}
                  <span class="aude-tname" ondblclick={() => startRename(s.id, s.label)} title={t('audio.renameHint')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && startRename(s.id, s.label)}>{s.label}</span>
                {/if}
                <input class="aude-alias" placeholder={t('audio.aliasPlaceholder')} value={s.alias ?? ''} onchange={(e) => audio.setSfxAlias(s.id, e.currentTarget.value)} aria-label={t('audio.alias')} title={t('audio.aliasTitle')} />
                <div class="aude-tilefoot">
                  <input class="aude-grp" placeholder={t('audio.group')} value={s.group ?? ''} onchange={(e) => audio.setSfxGroup(s.id, e.currentTarget.value)} aria-label={t('audio.group')} />
                  <input class="aude-gain" type="range" min="0" max="1" step="0.05" value={s.gain ?? 1} oninput={(e) => audio.setSfxGain(s.id, e.currentTarget.valueAsNumber)} title={t('audio.sfxGain')} aria-label={t('audio.sfxGain')} />
                </div>
              </div>
            {/each}
          </div>
        {/each}
      {:else}
        <p class="aude-hint">{t('audio.soundboardHint')}</p>
      {/if}

      <!-- mixer -->
      <div class="aude-caphead mixhead">
        <span class="aude-cap">{t('audio.mixer')}</span>
        <span class="aude-tacts">
          <label class="aude-toglbl"><input type="checkbox" checked={audio.duckSfx} onchange={() => audio.toggleDuck()} /> {t('audio.duck')}</label>
          <label class="aude-toglbl"><input type="checkbox" checked={audio.monitor} onchange={(e) => audio.setMonitor(e.currentTarget.checked)} /> {t('audio.monitor')}</label>
        </span>
      </div>
      <div class="aude-mixer">
        {#each [{ k: 'master', v: audio.masterVol, m: audio.masterMuted, l: t('audio.vol.master'), set: (n: number) => audio.setMasterVol(n) }, { k: 'ambient', v: audio.ambientVol, m: audio.ambientMuted, l: t('audio.vol.ambient'), set: (n: number) => audio.setAmbientVol(n) }, { k: 'sfx', v: audio.sfxVol, m: audio.sfxMuted, l: t('audio.vol.sfx'), set: (n: number) => audio.setSfxVol(n) }] as f (f.k)}
          <div class="aude-fader">
            <input type="checkbox" checked={!f.m} onchange={() => audio.toggleMute(f.k as 'master' | 'ambient' | 'sfx')} aria-label={t('audio.mute')} />
            <span class="aude-flbl">{f.l}</span>
            <input type="range" min="0" max="1" step="0.01" value={f.v} oninput={(e) => f.set(e.currentTarget.valueAsNumber)} aria-label={f.l} />
            <span class="aude-pct">{Math.round(f.v * 100)}</span>
          </div>
        {/each}
        <p class="aude-hint">{t('audio.mixerHint')}</p>
      </div>
    </aside>
  </div>
</div>

<style>
  .aude {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 20px;
    color: var(--txt);
    font-size: 13px;
  }
  /* ── header ── */
  .aude-top {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line1);
  }
  .aude-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 7px var(--gold);
  }
  .aude-top.closed .aude-dot {
    background: var(--red);
    box-shadow: 0 0 7px var(--red);
  }
  .aude-top.idle .aude-dot {
    background: var(--faint);
    box-shadow: none;
  }
  .aude-onair {
    color: var(--gold);
    font-weight: 700;
  }
  .aude-spacer {
    flex: 1;
  }
  .aude-conn {
    color: var(--faint);
    letter-spacing: 0;
  }
  .aude-panic {
    padding: 5px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--red-dim);
    background: var(--fill-red);
    color: var(--red);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .aude-panic:hover {
    background: var(--fill-red);
    border-color: var(--red);
  }
  /* ── grid ── */
  .aude-grid {
    display: grid;
    grid-template-columns: 214px minmax(0, 1fr) 300px;
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 880px) {
    .aude-grid {
      grid-template-columns: 1fr;
    }
  }
  .aude-cap {
    font-family: ui-monospace, monospace;
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .aude-caphead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .aude-caphead.mixhead {
    margin-top: 16px;
  }
  .aude-tacts {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .aude-mini {
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
    cursor: pointer;
    border-radius: var(--r2);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .aude-mini:hover {
    color: var(--gold);
    border-color: var(--gold);
  }
  .aude-hint {
    color: var(--faint);
    font-size: 11px;
    margin: 4px 0 0;
    line-height: 1.5;
  }
  /* ── scenes rail ── */
  .aude-rail {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: var(--r3);
    background: var(--bg1);
    border: 1px solid var(--line1);
  }
  .aude-scenes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .aude-scard {
    border-radius: var(--r2);
    border: 1px solid transparent;
    border-left: 3px solid transparent;
    background: var(--bg1);
  }
  .aude-scard.on {
    border-color: var(--line2);
    background: var(--fill-gold);
  }
  .aude-scard.live {
    border-left-color: var(--gold);
    background: var(--fill-gold);
  }
  .aude-spick {
    width: 100%;
    text-align: left;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 8px;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
  }
  .aude-sdot {
    grid-row: 1 / 3;
    align-self: center;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--faint);
  }
  .aude-scard.live .aude-sdot {
    background: var(--gold);
    box-shadow: 0 0 6px var(--gold);
  }
  .aude-sname {
    font-size: 13px;
    color: var(--txt);
  }
  .aude-smeta {
    font-size: 10.5px;
    color: var(--faint);
    font-family: ui-monospace, monospace;
  }
  .aude-svol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: var(--r2);
    border: 1px solid var(--line1);
    background: var(--bg1);
  }
  .aude-svol input[type='range'] {
    accent-color: var(--gold);
  }
  /* ── main column ── */
  .aude-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .aude-hero {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 14px;
  }
  .aude-avatar {
    width: 52px;
    height: 52px;
    border-radius: var(--r3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--serif);
    font-size: 26px;
    color: var(--green);
    background: var(--fill-g14);
    border: 1px solid var(--green-dim);
  }
  .aude-hinfo {
    min-width: 0;
  }
  .aude-htitle {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.1;
    color: var(--txt);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .aude-hsub {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .aude-wave {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 44px;
    cursor: pointer;
  }
  .aude-wave.dead {
    opacity: 0.4;
    cursor: default;
  }
  .aude-bar {
    flex: 1;
    min-width: 0;
    border-radius: 1px;
    background: var(--line2);
  }
  .aude-bar.lit {
    background: var(--gold);
  }
  /* ── transport ── */
  .aude-transport {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--r3);
    background: var(--bg1);
    border: 1px solid var(--line1);
    flex-wrap: wrap;
  }
  .aude-ic {
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .aude-ic:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
  }
  .aude-ic:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .aude-ic.sm {
    width: 26px;
    height: 26px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
  }
  .aude-ic.sm:hover {
    color: var(--gold);
    background: var(--fill-gold);
  }
  .aude-ic.del:hover {
    color: var(--red);
    background: var(--fill-red);
  }
  .aude-ic.sm.star {
    font-size: 14px;
  }
  .aude-ic.sm.star.on {
    color: var(--gold);
  }
  .aude-play {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    background: var(--gold);
    color: var(--gold-ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 14px var(--fill-gold);
  }
  .aude-play:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .aude-play:disabled {
    opacity: 0.4;
    box-shadow: none;
    cursor: default;
  }
  .aude-clock {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: var(--txt);
    font-variant-numeric: tabular-nums;
    margin-left: 4px;
  }
  .aude-idx {
    color: var(--faint);
  }
  .aude-tspacer {
    flex: 1;
  }
  .aude-tbtn {
    padding: 6px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .aude-tbtn:hover:not(:disabled) {
    color: var(--gold);
    border-color: var(--gold);
  }
  .aude-tbtn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  /* ── track list ── */
  .aude-tracks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .aude-tracks li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--r2);
    background: var(--bg1);
    border: 1px solid transparent;
    border-left: 3px solid transparent;
  }
  .aude-tracks li.playing {
    border-left-color: var(--gold);
    background: var(--fill-gold);
  }
  .aude-tracks li.drag {
    opacity: 0.5;
    border-color: var(--gold);
  }
  .aude-grip {
    cursor: grab;
    color: var(--faint);
    letter-spacing: -2px;
  }
  .aude-pf {
    border: 0;
    background: transparent;
    color: var(--gold);
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    display: flex;
  }
  .aude-lbl {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .aude-badge {
    font-family: ui-monospace, monospace;
    font-size: 9px;
    padding: 2px 5px;
    border-radius: var(--r1);
    background: var(--line1);
    color: var(--muted);
    letter-spacing: 0.05em;
  }
  .aude-badge.yt {
    background: var(--fill-red);
    color: var(--red);
  }
  .aude-dur {
    color: var(--faint);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    width: 34px;
    text-align: right;
  }
  .aude-gain {
    width: 68px;
    accent-color: var(--gold);
  }
  /* ── drop zone + youtube ── */
  .aude-drop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px dashed var(--line2);
    border-radius: var(--r2);
    color: var(--faint);
    font-size: 11px;
  }
  .aude-ytopt {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
  }
  .aude-ytrow {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  /* ── soundboard ── */
  .aude-right {
    display: flex;
    flex-direction: column;
    padding: 12px;
    border-radius: var(--r3);
    background: var(--bg1);
    border: 1px solid var(--line1);
  }
  .aude-grouplbl {
    font-family: ui-monospace, monospace;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold);
    opacity: 0.8;
    margin: 10px 0 5px;
  }
  .aude-board {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .aude-tile {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px 8px;
    border-radius: var(--r2);
    background: var(--bg1);
    border: 1px solid var(--line2);
  }
  .aude-tile.pinned {
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  .aude-tilehd {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .aude-tsp {
    flex: 1;
  }
  .aude-tname {
    font-size: 12px;
    color: var(--txt);
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: text;
    min-height: 2.4em;
  }
  .aude-tilefoot {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .aude-tilefoot .aude-gain {
    width: auto;
    flex: 1;
    min-width: 0;
  }
  .aude-star {
    border: 0;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
  }
  .aude-star.on {
    color: var(--gold);
  }
  .aude-hk {
    width: 14px;
    text-align: center;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: var(--faint);
  }
  .aude-grp {
    width: 54px;
    flex: none;
    padding: 3px 5px;
    border-radius: var(--r1);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 10px;
  }
  .aude-alias {
    width: 100%;
    padding: 3px 6px;
    border-radius: var(--r1);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--green);
    font: inherit;
    font-size: 11px;
  }
  .aude-alias::placeholder {
    color: var(--faint);
  }
  /* ── mixer ── */
  .aude-toglbl {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--muted);
    font-family: ui-monospace, monospace;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .aude-mixer {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 10px;
    border-radius: var(--r2);
    background: var(--bg1);
    border: 1px solid var(--line1);
  }
  .aude-fader {
    display: grid;
    grid-template-columns: 16px 62px 1fr 26px;
    align-items: center;
    gap: 8px;
  }
  .aude-fader input[type='range'] {
    accent-color: var(--gold);
    min-width: 0;
  }
  .aude-flbl {
    font-size: 11px;
    color: var(--muted);
  }
  .aude-pct {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--muted);
    font-family: ui-monospace, monospace;
  }
  /* ── shared inputs/buttons ── */
  .aude-in {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .aude-btn {
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    padding: 5px 10px;
    white-space: nowrap;
  }
  .aude-btn:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
  }
  .aude-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .aude-btn.rec {
    border-color: var(--red);
    color: var(--red);
    background: var(--fill-red);
  }
  .aude-btn.del {
    align-self: flex-start;
    margin-top: 4px;
    color: var(--muted);
  }
  .aude-btn.del:hover:not(:disabled) {
    color: var(--red);
    border-color: var(--red);
  }
</style>
