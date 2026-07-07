<script lang="ts">
  import { onMount } from 'svelte';
  import { audio } from './store.svelte';
  import { formatTime, sfxDisplay, type RepeatMode } from './logic';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';

  let mixOpen = $state(false);
  let flashing = $state<Record<string, boolean>>({}); // sfx id -> mid-flash
  let now = $state(Date.now()); // ticking clock for the on-air pill

  // Panic "silence" overlay: remembers the scene/position so the bar can resume.
  let panicked = $state(false);
  let panicMemo = $state<{ scene: string; label: string; pos: number } | null>(null);

  const onAirScene = $derived(audio.scenes.find((p) => p.id === audio.playingScene));
  const curTrack = $derived(onAirScene?.tracks[audio.trackIndex]);
  const remaining = $derived(Math.max(0, audio.duration - audio.position));
  const heroLabel = $derived(onAirScene?.name ?? t('audio.nothingPlaying'));
  const heroInitial = $derived((onAirScene?.name ?? '·').trim().charAt(0).toUpperCase() || '·');
  const pads = $derived(audio.pinnedSfx);
  const ambientPads = $derived(audio.pinnedTracks);

  // Output status: idle (nothing playing) / live (status flowing) / closed
  // (playing but no status heartbeat — the broadcast tab is probably shut).
  const output = $derived(
    !audio.playingScene ? 'idle' : now - audio.lastStatusAt < 3000 ? 'live' : 'closed'
  );

  // Crossfade cycle presets (ms) surfaced as the small ✕ glyph.
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

  // Deterministic pseudo-waveform (same shape every render).
  const bars = Array.from({ length: 48 }, (_, i) =>
    0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))
  );
  const progress = $derived(audio.duration > 0 ? audio.position / audio.duration : 0);

  onMount(() => {
    void audio.load();
    const offStatus = audio.subscribeStatus();
    const clock = setInterval(() => (now = Date.now()), 1000);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.key === ' ' && audio.playingScene) {
        e.preventDefault();
        audio.togglePause();
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        const s = pads[Number(e.key) - 1];
        if (s) playPad(s.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offStatus();
      clearInterval(clock);
      window.removeEventListener('keydown', onKey);
    };
  });

  function playPad(id: string) {
    audio.playSfx(id);
    flashing[id] = true;
    setTimeout(() => (flashing[id] = false), 650);
  }

  function pickScene(id: string) {
    if (audio.playingScene === id) audio.togglePause();
    else audio.playScene(id);
  }

  function cycleRepeat() {
    const order: RepeatMode[] = ['off', 'scene', 'track'];
    audio.setRepeat(order[(order.indexOf(audio.repeat) + 1) % order.length]);
  }
  function cycleFade() {
    audio.setCrossfade(FADES[(FADES.indexOf(audio.crossfadeMs) + 1 + FADES.length) % FADES.length]);
  }

  function doPanic() {
    panicMemo = audio.playingScene
      ? { scene: audio.playingScene, label: heroLabel, pos: audio.position }
      : null;
    audio.panic();
    panicked = true;
  }
  function doResume() {
    panicked = false;
    const m = panicMemo;
    panicMemo = null;
    if (!m) return;
    audio.playScene(m.scene);
    if (m.pos > 0) audio.seek(m.pos);
  }

  // click-to-seek on the waveform (native <audio> only)
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

  function openBroadcast() {
    window.open('broadcast.html', 'gm-broadcast', 'width=1280,height=720');
  }
</script>

<div class="aud" data-no-drag>
  {#if panicked}
    <!-- ── Silence overlay (post-panic) ───────────────────────── -->
    <div class="aud-head aud-silenced">
      <span class="aud-dot"></span>
      <span class="aud-onair">{t('audio.silenced')}</span>
      <span class="aud-conn">{t('audio.broadcastConnected')}</span>
    </div>
    <div class="aud-silbody">
      <div class="aud-silmark"><Icon name="stop" size={26} /></div>
      <div class="aud-siltitle">— {t('audio.silence')} —</div>
      <p class="aud-silline">{t('audio.silenceStopped')}<br />{t('audio.silenceCut')}</p>
      {#if panicMemo}
        <p class="aud-silmemo">{panicMemo.label} · {t('audio.pausedAt')} {formatTime(panicMemo.pos)}</p>
      {/if}
    </div>
    <button class="aud-resume" onclick={doResume}>{t('audio.tapToResume')}</button>
  {:else}
    <!-- ── Header: on-air status + MON / MIX ──────────────────── -->
    <div class="aud-head {output}">
      <span class="aud-dot"></span>
      <span class="aud-onair">
        {#if output === 'closed'}{t('audio.outputClosed')}{:else if output === 'live'}{t('audio.outputLive')}{:else}{t('audio.outputIdle')}{/if}
      </span>
      <span class="aud-conn">
        {output === 'idle' ? '' : output === 'closed' ? t('audio.broadcastShut') : t('audio.broadcastConnected')}
      </span>
      <button class="aud-tog" class:on={audio.monitor} onclick={() => audio.setMonitor(!audio.monitor)} title={t('audio.monitorTitle')}>{t('audio.mon')}</button>
      <button class="aud-tog" class:on={mixOpen} onclick={() => (mixOpen = !mixOpen)}>{t('audio.mix')} ▾</button>
    </div>

    <!-- ── Now-playing hero ───────────────────────────────────── -->
    <div class="aud-hero">
      <div class="aud-avatar">{heroInitial}</div>
      <div class="aud-hinfo">
        <div class="aud-title">{heroLabel}</div>
        <div class="aud-sub">{audio.playingScene ? (curTrack?.label ?? '—') : t('audio.nothingPlaying')}</div>
      </div>
    </div>

    <!-- waveform / seek -->
    <div
      class="aud-wave"
      class:dead={!audio.playingScene}
      onclick={onWaveClick}
      onkeydown={onWaveKey}
      role="slider"
      tabindex="0"
      aria-label={t('audio.seek')}
      aria-valuenow={Math.round(audio.position)}
      aria-valuemax={Math.round(audio.duration)}
    >
      {#each bars as h, i (i)}
        <span class="aud-bar" class:lit={i / bars.length <= progress} style="height:{Math.round(h * 100)}%"></span>
      {/each}
    </div>
    <div class="aud-times">
      {#if audio.playingYouTube}
        <span class="aud-t">YT</span>
        <span class="aud-tidx">{audio.trackIndex + 1} / {audio.trackCount}</span>
        <span></span>
      {:else}
        <span class="aud-t">{formatTime(audio.position)}</span>
        <span class="aud-tidx">{audio.playingScene ? `${t('audio.tracks').toUpperCase()} ${audio.trackIndex + 1} / ${audio.trackCount}` : ''}</span>
        <span class="aud-t rem">{formatTime(remaining || audio.duration)}</span>
      {/if}
    </div>

    <!-- ── Transport ──────────────────────────────────────────── -->
    <div class="aud-transport">
      <button class="aud-glyph" onclick={cycleRepeat} title={t('audio.repeat')}>
        <span class="aud-gsym">↺</span><span class="aud-glabel">{repeatLabel}</span>
      </button>
      <button class="aud-ic" onclick={() => audio.prev()} disabled={!audio.playingScene} aria-label={t('audio.prev')}><Icon name="prev" /></button>
      <button class="aud-play" onclick={() => audio.togglePause()} disabled={!audio.playingScene} aria-label={audio.paused ? t('audio.resume') : t('audio.pause')}><Icon name={audio.paused ? 'play' : 'pause'} size={20} /></button>
      <button class="aud-ic" onclick={() => audio.next()} disabled={!audio.playingScene} aria-label={t('audio.next')}><Icon name="next" /></button>
      <button class="aud-glyph" onclick={cycleFade} title={t('audio.crossfade')}>
        <span class="aud-gsym">✕</span><span class="aud-glabel">{fadeLabel}</span>
      </button>
    </div>

    <!-- ── Mood chips (one-tap crossfade) ─────────────────────── -->
    <div class="aud-caplbl">{t('audio.moodLabel')}</div>
    <div class="aud-moods">
      {#each audio.scenes as p (p.id)}
        <button class="aud-chip" class:live={audio.playingScene === p.id} onclick={() => pickScene(p.id)} disabled={!p.tracks.length}>
          {p.name}
        </button>
      {/each}
    </div>

    <!-- ── Quick board ────────────────────────────────────────── -->
    <div class="aud-caplbl">{t('audio.quickBoard')}</div>
    {#if pads.length}
      <div class="aud-pads">
        {#each pads as s, i (s.id)}
          <button class="aud-pad" class:flash={flashing[s.id]} onclick={() => playPad(s.id)} oncontextmenu={(e) => { e.preventDefault(); audio.audition(s.assetId); }} title={t('audio.audition')}>
            {#if i < 9}<kbd>{i + 1}</kbd>{/if}
            <span class="aud-padlbl">{sfxDisplay(s)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="aud-hint">{t('audio.quickBoardHint')}</p>
    {/if}

    <!-- ── Ambient board (pinned tracks · YT audio-only) ──────── -->
    <div class="aud-caplbl">{t('audio.ambientBoard')}</div>
    {#if ambientPads.length}
      <div class="aud-ambpads">
        {#each ambientPads as p (p.track.id)}
          <button
            class="aud-ambpad"
            class:live={audio.playingScene === p.sceneId && audio.trackIndex === p.index}
            onclick={() => audio.playPinnedTrack(p.sceneId, p.index)}
          >
            <span class="aud-ambico">{p.track.youtubeId ? '▶' : '♪'}</span>
            <span class="aud-ambinfo">
              <span class="aud-amblbl">{p.track.label}</span>
              <span class="aud-ambscn">{p.sceneName}{p.track.youtubeId ? ' · YT' : ''}</span>
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="aud-hint">{t('audio.ambientBoardHint')}</p>
    {/if}

    <!-- ── Mixer (progressive disclosure) ─────────────────────── -->
    {#if mixOpen}
      <div class="aud-mixer">
        {#each [{ k: 'master', v: audio.masterVol, m: audio.masterMuted, l: t('audio.vol.master'), set: (n: number) => audio.setMasterVol(n) }, { k: 'ambient', v: audio.ambientVol, m: audio.ambientMuted, l: t('audio.vol.ambient'), set: (n: number) => audio.setAmbientVol(n) }, { k: 'sfx', v: audio.sfxVol, m: audio.sfxMuted, l: t('audio.vol.sfx'), set: (n: number) => audio.setSfxVol(n) }] as f (f.k)}
          <div class="aud-fader">
            <button class="aud-ic sm" class:muted={f.m} onclick={() => audio.toggleMute(f.k as 'master' | 'ambient' | 'sfx')} aria-label={t('audio.mute')}>{f.m ? '🔇' : '🔊'}</button>
            <span class="aud-flbl">{f.l}</span>
            <input type="range" min="0" max="1" step="0.01" value={f.v} oninput={(e) => f.set(e.currentTarget.valueAsNumber)} aria-label={f.l} />
            <span class="aud-pct">{Math.round(f.v * 100)}</span>
          </div>
        {/each}
        <label class="aud-duck"><input type="checkbox" checked={audio.duckSfx} onchange={() => audio.toggleDuck()} /> {t('audio.duck')}</label>
        {#if output !== 'live'}
          <button class="aud-tog" onclick={openBroadcast}>{t('audio.openBroadcast')}</button>
        {/if}
      </div>
    {/if}

    <!-- ── Panic bar ──────────────────────────────────────────── -->
    <button class="aud-panic" onclick={doPanic}>⛔ {t('audio.stopAll')}</button>
  {/if}
</div>

<style>
  .aud {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    color: var(--txt);
  }
  /* ── header ── */
  .aud-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.12em;
  }
  .aud-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--faint);
    flex: none;
  }
  .aud-head.live .aud-dot,
  .aud-head.idle .aud-dot {
    background: var(--gold);
    box-shadow: 0 0 7px var(--gold);
  }
  .aud-head.closed .aud-dot {
    background: var(--red);
    box-shadow: 0 0 7px var(--red);
  }
  .aud-onair {
    color: var(--gold);
    text-transform: uppercase;
    font-weight: 700;
  }
  .aud-head.closed .aud-onair {
    color: var(--red);
  }
  .aud-conn {
    flex: 1;
    color: var(--faint);
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font, inherit);
    font-size: 11px;
  }
  .aud-tog {
    padding: 3px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
    cursor: pointer;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .aud-tog:hover {
    color: var(--txt);
    border-color: var(--gold);
  }
  .aud-tog.on {
    color: var(--gold);
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  /* ── hero ── */
  .aud-hero {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .aud-avatar {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: var(--r3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--serif);
    font-size: 24px;
    color: var(--green);
    background: var(--fill-g14);
    border: 1px solid var(--green-dim);
  }
  .aud-hinfo {
    min-width: 0;
  }
  .aud-title {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.1;
    color: var(--txt);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .aud-sub {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* ── waveform ── */
  .aud-wave {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 40px;
    cursor: pointer;
    padding: 0 1px;
  }
  .aud-wave.dead {
    opacity: 0.4;
    cursor: default;
  }
  .aud-bar {
    flex: 1;
    min-width: 0;
    border-radius: 1px;
    background: var(--line2);
  }
  .aud-bar.lit {
    background: var(--gold);
  }
  .aud-times {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .aud-times .aud-tidx {
    text-align: center;
    color: var(--faint);
    letter-spacing: 0.08em;
  }
  .aud-times .rem {
    text-align: right;
    color: var(--faint);
  }
  /* ── transport ── */
  .aud-transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 4px 0 2px;
  }
  .aud-glyph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 48px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-family: ui-monospace, monospace;
  }
  .aud-glyph:hover {
    color: var(--gold);
  }
  .aud-gsym {
    font-size: 15px;
    line-height: 1;
  }
  .aud-glabel {
    font-size: 8.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .aud-ic {
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .aud-ic:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
  }
  .aud-ic:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .aud-ic.muted {
    color: var(--red);
  }
  .aud-ic.sm {
    width: 26px;
    height: 26px;
    border: 0;
    background: transparent;
    font-size: 13px;
  }
  .aud-play {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    border: 0;
    background: var(--gold);
    color: var(--gold-ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 18px var(--fill-gold);
  }
  .aud-play:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .aud-play:disabled {
    opacity: 0.4;
    box-shadow: none;
    cursor: default;
  }
  /* ── captions ── */
  .aud-caplbl {
    font-family: ui-monospace, monospace;
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
    margin-top: 2px;
  }
  /* ── mood chips ── */
  .aud-moods {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .aud-chip {
    padding: 6px 13px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .aud-chip:hover:not(:disabled) {
    color: var(--txt);
    border-color: var(--gold);
  }
  .aud-chip:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .aud-chip.live {
    color: var(--gold-ink);
    background: var(--gold);
    border-color: var(--gold);
    font-weight: 600;
  }
  /* ── quick board ── */
  .aud-pads {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .aud-pad {
    position: relative;
    min-height: 50px;
    display: flex;
    align-items: flex-end;
    text-align: left;
    padding: 7px 9px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font-size: 12px;
    overflow: hidden;
  }
  .aud-pad:hover {
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  .aud-pad.flash {
    animation: aud-flash 0.65s ease-out;
  }
  @keyframes aud-flash {
    0% {
      box-shadow: 0 0 0 0 var(--gold);
      background: var(--fill-gold);
    }
    100% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
  .aud-pad kbd {
    position: absolute;
    top: 5px;
    left: 8px;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: var(--faint);
  }
  .aud-padlbl {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.15;
  }
  .aud-hint {
    color: var(--faint);
    font-size: 11px;
    margin: 0;
  }
  /* ── ambient board ── */
  .aud-ambpads {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .aud-ambpad {
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    padding: 7px 10px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
  }
  .aud-ambpad:hover {
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  .aud-ambpad.live {
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  .aud-ambico {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--green);
    background: var(--fill-g14);
    border: 1px solid var(--green-dim);
  }
  .aud-ambpad.live .aud-ambico {
    color: var(--gold-ink);
    background: var(--gold);
    border-color: var(--gold);
  }
  .aud-ambinfo {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .aud-amblbl {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .aud-ambscn {
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* ── mixer ── */
  .aud-mixer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: var(--r3);
    background: var(--bg1);
    border: 1px solid var(--line2);
  }
  .aud-fader {
    display: grid;
    grid-template-columns: 26px 68px 1fr 26px;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--muted);
  }
  .aud-fader input[type='range'] {
    accent-color: var(--gold);
    min-width: 0;
  }
  .aud-flbl {
    font-size: 11px;
  }
  .aud-pct {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }
  .aud-duck {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* ── panic ── */
  .aud-panic {
    margin-top: 2px;
    width: 100%;
    padding: 11px;
    border-radius: var(--r3);
    border: 1px solid var(--red-dim);
    background: var(--fill-red);
    color: var(--red);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .aud-panic:hover {
    background: var(--fill-red);
    border-color: var(--red);
    color: var(--red);
  }
  /* ── silence overlay ── */
  .aud-head.aud-silenced .aud-dot {
    background: var(--red);
    box-shadow: 0 0 7px var(--red);
  }
  .aud-head.aud-silenced .aud-onair {
    color: var(--red);
  }
  .aud-silbody {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 26px 12px 20px;
    text-align: center;
  }
  .aud-silmark {
    width: 78px;
    height: 78px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--red);
    border: 2px solid var(--red-dim);
  }
  .aud-siltitle {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--red);
    letter-spacing: 0.04em;
  }
  .aud-silline {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .aud-silmemo {
    margin: 0;
    color: var(--faint);
    font-size: 11px;
    font-family: ui-monospace, monospace;
  }
  .aud-resume {
    width: 100%;
    padding: 12px;
    border-radius: var(--r3);
    border: 0;
    background: var(--red-dim);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 12px;
  }
  .aud-resume:hover {
    filter: brightness(1.08);
  }
</style>
