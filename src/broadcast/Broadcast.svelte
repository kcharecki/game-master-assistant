<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet, assetUrl } from '../lib/db';
  import { lang, t } from '../lib/i18n';
  import type { BroadcastPayload, DisplayMode } from '../lib/types';
  import { DISPLAY_MODE_KEY, DEFAULT_DISPLAY_MODE, normalizeMode } from './display';
  import { MOOD_KEY, DEFAULT_MOOD, moodById, normalizeMood, moodStyle, type Mood } from './mood';
  import { clampCols, gridAssetIds } from './grid';
  import { conditionGlyph, conditionMeta } from '../modules/map/conditions';

  let payload = $state<BroadcastPayload>({ kind: 'clear' });
  let mode = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  let mood = $state<Mood>(DEFAULT_MOOD);
  const mstyle = $derived(moodStyle(mood));
  // Transient ping marker (normalized 0..1) that overlays current content.
  let ping = $state<{ x: number; y: number } | null>(null);
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  const CELL = 48; // viewBox cell size; aspect-ratio only, scales to fit

  // Audio routed here so it plays in the shared tab (not throttled when GM tab hides).
  let ambientEl: HTMLAudioElement;
  let sfxEl: HTMLAudioElement;
  // Browsers block audio until the user interacts with THIS tab. Until unlocked,
  // we hold the last cue and replay it once the keeper clicks to enable sound.
  let audioLocked = $state(false);
  let pendingCue: Extract<BroadcastPayload, { kind: 'audio' }> | null = null;
  // Object URLs are created in THIS tab from shared-IndexedDB blobs; revoke on replace.
  let ambientUrl = '';
  // YouTube ambient: rendered as an iframe (the autoplay/loop embed). Seek scrubbing
  // would need the JS IFrame API (out of scope) — Rewind re-mounts via `youtubeNonce`.
  let youtubeId = $state<string | null>(null);
  let youtubeNonce = $state(0);
  // Sound-only mode: keep the iframe playing but hidden offscreen (players see
  // only the normal broadcast content). Unmuted so it's actually audible.
  let youtubeAudioOnly = $state(false);
  // Foreground arbitration: the most recent action wins the screen. Playing a
  // video-mode YT track foregrounds the video; pushing any on-air content
  // foregrounds that content (and backgrounds the video). The video also shows
  // when the stage is clear. Audio-only is always hidden in the background.
  let ytVideoFg = $state(false);
  const ytBackground = $derived(
    youtubeAudioOnly || (!ytVideoFg && payload.kind !== 'clear')
  );

  // Preview mode (?preview=1): a silent visual mirror embedded on the GM desktop.
  // It renders all on-air visuals (incl. a muted YouTube video) but never plays
  // audio — otherwise the preview would double the broadcast tab's sound.
  const isPreview =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('preview');
  // Reverse status channel back to the GM tab; opened in onMount (no import-time bus).
  let statusBus: ReturnType<typeof createBus> | null = null;
  let lastStatusAt = 0;

  function postAmbientStatus(force = false) {
    if (!statusBus || !ambientEl) return;
    const now = Date.now();
    if (!force && now - lastStatusAt < 500) return; // throttle timeupdate to ~2/s
    lastStatusAt = now;
    const duration = Number.isFinite(ambientEl.duration) ? ambientEl.duration : 0;
    statusBus.sendAudioStatus({
      channel: 'ambient',
      current: ambientEl.currentTime,
      duration,
      playing: !ambientEl.paused,
    });
  }

  // Resolve an on-air image's asset to a tab-local URL (assetId), or use an
  // external src directly. blob: URLs from the GM tab never resolve here.
  let imgSrc = $state('');
  $effect(() => {
    const p = payload;
    if (p.kind !== 'image') {
      imgSrc = '';
      return;
    }
    if (p.src) {
      imgSrc = p.src;
      return;
    }
    if (p.assetId) {
      let url = '';
      void assetUrl(p.assetId).then((u) => {
        if (u) {
          url = u;
          imgSrc = u;
        }
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
    imgSrc = '';
  });

  // Resolve a map background's asset (assetId) to a tab-local URL, or use an
  // external src directly — same cross-tab blob rule as on-air images.
  let mapSrc = $state('');
  $effect(() => {
    const p = payload;
    if (p.kind !== 'map') {
      mapSrc = '';
      return;
    }
    if (p.src) {
      mapSrc = p.src;
      return;
    }
    if (p.assetId) {
      let url = '';
      void assetUrl(p.assetId).then((u) => {
        if (u) {
          url = u;
          mapSrc = u;
        }
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
    mapSrc = '';
  });

  // Resolve grid image cells' asset ids -> tab-local object URLs, revoking
  // any no-longer-referenced URLs. Same asset-id-over-bus rule as `imgSrc`.
  let gridUrls = $state<Record<string, string>>({});
  $effect(() => {
    const want = payload.kind === 'grid' ? new Set(gridAssetIds(payload.cells)) : new Set<string>();
    for (const [id, url] of Object.entries(gridUrls)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete gridUrls[id];
      }
    }
    for (const id of want) {
      if (!gridUrls[id]) {
        void assetUrl(id).then((u) => {
          if (u) gridUrls[id] = u;
        });
      }
    }
  });
  $effect(() => () => {
    for (const url of Object.values(gridUrls)) URL.revokeObjectURL(url);
  });

  function flashPing(x: number, y: number) {
    ping = { x, y };
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => (ping = null), 1500);
  }

  async function handleAudio(cue: Extract<BroadcastPayload, { kind: 'audio' }>) {
    // Preview mirror: reflect the YouTube video state (muted, via the iframe)
    // but never touch native <audio> or post status — stay silent.
    if (isPreview) {
      if (cue.channel !== 'ambient') return;
      if (cue.action === 'stop') youtubeId = null;
      else if (cue.action === 'play') {
        if (cue.youtubeId) {
          youtubeId = cue.youtubeId;
          youtubeAudioOnly = !!cue.audioOnly;
          ytVideoFg = !cue.audioOnly;
          youtubeNonce += 1;
        } else {
          youtubeId = null;
        }
      }
      return;
    }
    const el = cue.channel === 'ambient' ? ambientEl : sfxEl;
    if (!el) return;
    if (cue.action === 'stop') {
      el.pause();
      if (cue.channel === 'ambient') {
        youtubeId = null; // tear down any YT iframe
        if (ambientUrl) {
          URL.revokeObjectURL(ambientUrl);
          ambientUrl = '';
        }
        postAmbientStatus(true);
      }
      return;
    }
    if (cue.action === 'seek') {
      // Fine seek applies to native <audio> only (ambient). YouTube has no JS
      // seek here (IFrame API out of scope) — the GM uses Rewind, which re-mounts.
      if (cue.channel === 'ambient' && !youtubeId) {
        const dur = Number.isFinite(ambientEl.duration) ? ambientEl.duration : Infinity;
        ambientEl.currentTime = Math.min(Math.max(0, cue.seek ?? 0), dur);
        postAmbientStatus(true);
      }
      return;
    }
    // play action.
    if (cue.channel === 'ambient' && cue.youtubeId) {
      // YouTube ambient: pause native audio and (re)mount the iframe.
      el.pause();
      if (ambientUrl) {
        URL.revokeObjectURL(ambientUrl);
        ambientUrl = '';
      }
      youtubeId = cue.youtubeId;
      youtubeAudioOnly = !!cue.audioOnly;
      ytVideoFg = !cue.audioOnly; // video mode → the video takes the foreground
      youtubeNonce += 1;
      return;
    }
    if (cue.channel === 'ambient') youtubeId = null; // switching back to native audio
    // Resolve the blob locally (assetId), or fall back to an external src.
    const url = cue.assetId ? await assetUrl(cue.assetId) : cue.src;
    if (!url) return;
    if (cue.channel === 'ambient') {
      if (ambientUrl) URL.revokeObjectURL(ambientUrl);
      ambientUrl = cue.assetId ? url : '';
    }
    el.loop = cue.loop;
    el.src = url;
    el.play().catch(() => {
      // Autoplay blocked — surface the unlock prompt and remember the cue.
      pendingCue = cue;
      audioLocked = true;
    });
  }

  // First user gesture in this tab unlocks audio; replay any held cue.
  function unlockAudio() {
    audioLocked = false;
    const cue = pendingCue;
    pendingCue = null;
    if (cue) void handleAudio(cue);
  }

  onMount(() => {
    void lang.load();
    // Rehydrate last shared state + display mode, then listen for live GM pushes.
    void kvGet<BroadcastPayload>('broadcastState').then((saved) => {
      if (saved) payload = saved;
    });
    void kvGet<unknown>(DISPLAY_MODE_KEY).then((saved) => {
      mode = normalizeMode(saved);
    });
    void kvGet<unknown>(MOOD_KEY).then((saved) => {
      mood = normalizeMood(saved);
    });
    const bus = createBus();
    statusBus = bus; // reuse for the reverse audioStatus channel
    const off = bus.on((m) => {
      if (m.type === 'audioStatus') return; // our own reverse reports; ignore
      if (m.type === 'display') mode = m.mode;
      else if (m.type === 'mood') mood = moodById(m.moodId);
      else if (m.payload.kind === 'ping') flashPing(m.payload.x, m.payload.y);
      else if (m.payload.kind === 'audio') handleAudio(m.payload);
      else {
        payload = m.payload;
        ytVideoFg = false; // new on-air content takes the foreground from the video
      }
    });
    return () => {
      off();
      bus.close();
      statusBus = null;
      clearTimeout(pingTimer);
      if (ambientUrl) URL.revokeObjectURL(ambientUrl);
    };
  });
</script>

<div class="broadcast" class:plain={mode === 'plain'} style="filter:{mstyle.filter}">
  {#if payload.kind === 'text'}
    <div class="card">
      {#if payload.title}<h1>{payload.title}</h1>{/if}
      <p>{payload.body}</p>
    </div>
  {:else if payload.kind === 'image'}
    <figure>
      {#if imgSrc}<img src={imgSrc} alt={payload.caption ?? ''} />{/if}
      {#if payload.caption}<figcaption>{payload.caption}</figcaption>{/if}
    </figure>
  {:else if payload.kind === 'map'}
    {@const cols = payload.reveal[0]?.length ?? 0}
    {@const rows = payload.reveal.length}
    <!-- One shared world space (px). The `view` fragment sets the viewBox (fills
         the player window, ratio kept); the background is placed by its calibrated
         rect so image/grid/fog/tokens align with the GM. -->
    {@const vf = payload.view ?? { x: 0, y: 0, w: cols * CELL, h: rows * CELL }}
    <div class="mapview">
      <svg
        viewBox="{vf.x} {vf.y} {vf.w} {vf.h}"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="bgrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path
              d="M {CELL} 0 L 0 0 0 {CELL}"
              fill="none"
              stroke="rgba(95,150,120,.22)"
              stroke-width="1"
            />
          </pattern>
        </defs>
        {#if mapSrc}
          {@const im = payload.img ?? { x: vf.x, y: vf.y, w: vf.w, h: vf.h }}
          <image href={mapSrc} x={im.x} y={im.y} width={im.w} height={im.h} preserveAspectRatio="none" />
        {/if}
        <!-- battle grid (1 cell = 1 metre) -->
        <rect x={vf.x} y={vf.y} width={vf.w} height={vf.h} fill="url(#bgrid)" />

        <!-- tokens (player-safe: position + label only) -->
        {#each payload.tokens ?? [] as tk, i (i)}
          {#if payload.reveal[tk.gy]?.[tk.gx] === 1}
            <g transform="translate({tk.gx * CELL} {tk.gy * CELL})">
              <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 4} fill={tk.color} />
              <text x={CELL / 2} y={CELL / 2 + 4} text-anchor="middle" class="tlbl">{tk.label}</text>
              {#each tk.conditions ?? [] as cid, j (cid)}
                <text x={CELL / 2} y={CELL + 12 + j * 13} text-anchor="middle" class="tcond">
                  {conditionGlyph(cid)} {conditionMeta(cid)?.label ?? cid}
                </text>
              {/each}
            </g>
          {/if}
        {/each}

        {#each payload.reveal as fogRow, row (row)}
          {#each fogRow as cell, col (col)}
            {#if cell === 0}
              <!-- Hidden: fully opaque so players never see beyond the fog. -->
              <rect x={col * CELL} y={row * CELL} width={CELL} height={CELL} fill="#05090a" />
            {/if}
          {/each}
        {/each}
      </svg>
    </div>
  {:else if payload.kind === 'grid'}
    <div
      class="grid"
      style="grid-template-columns: repeat({clampCols(payload.cols, payload.cells.length)}, 1fr)"
    >
      {#each payload.cells as cell, i (i)}
        {#if cell.kind === 'image'}
          {@const url = cell.assetId ? gridUrls[cell.assetId] : cell.src}
          <figure class="gcell">
            {#if url}<img src={url} alt={cell.caption ?? ''} />{/if}
            {#if cell.caption}<figcaption>{cell.caption}</figcaption>{/if}
          </figure>
        {:else}
          <div class="gcell gtext">
            {#if cell.title}<h2>{cell.title}</h2>{/if}
            {#if cell.body}<p>{cell.body}</p>{/if}
          </div>
        {/if}
      {/each}
    </div>
  {:else if !youtubeId}
    <div class="idle">{t('broadcast.idle')}</div>
  {/if}

  <!-- Mood/lighting wash, layered over content but under transient markers. -->
  <div class="mood" style="background:{mstyle.overlay}"></div>

  {#if ping}
    <div class="ping" style="left:{ping.x * 100}%; top:{ping.y * 100}%"></div>
  {/if}

  {#if audioLocked}
    <button class="unlock" onclick={unlockAudio}>{t('broadcast.enableAudio')}</button>
  {/if}

  <!-- YouTube ambient embed (autoplay + loop). Muted fallback eases autoplay
       blocking; the keeper can unmute via YouTube's own controls. No JS seek. -->
  {#if youtubeId}
    {#key youtubeNonce}
      <!-- Audio-only: unmuted (so it's audible) but hidden offscreen. Visible:
           muted so autoplay isn't blocked; the keeper unmutes via YT controls. -->
      <iframe
        class="ytplayer"
        class:audioonly={ytBackground}
        title="Ambient YouTube"
        src="https://www.youtube-nocookie.com/embed/{youtubeId}?autoplay=1&loop=1&playlist={youtubeId}{youtubeAudioOnly &&
        !isPreview
          ? ''
          : '&mute=1'}"
        allow="autoplay"
        frameborder="0"
      ></iframe>
    {/key}
  {/if}

  <!-- Audio routed through this shared tab; hidden, GM-controlled via the bus.
       Ambient posts position back over the reverse bus channel for the transport. -->
  <audio
    bind:this={ambientEl}
    ontimeupdate={() => postAmbientStatus()}
    ondurationchange={() => postAmbientStatus(true)}
    onplay={() => postAmbientStatus(true)}
    onpause={() => postAmbientStatus(true)}
  ></audio>
  <audio bind:this={sfxEl}></audio>
</div>

<style>
  .broadcast {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 6vh 6vw;
    background: radial-gradient(120% 100% at 50% 0%, #0d1b16, #05090a 70%);
    color: var(--txt);
  }
  .idle {
    color: var(--faint);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 13px;
  }
  .card {
    max-width: 720px;
    text-align: center;
  }
  .card h1 {
    font-family: Georgia, serif;
    color: var(--green);
    font-size: clamp(28px, 5vw, 52px);
    margin-bottom: 18px;
  }
  .card p {
    font-size: clamp(16px, 2.4vw, 26px);
    line-height: 1.6;
  }
  figure {
    text-align: center;
  }
  figure img {
    max-width: 80vw;
    max-height: 70vh;
    border-radius: 12px;
    border: 1px solid var(--line2);
  }
  .mapview {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }
  .mapview svg {
    max-width: 86vw;
    max-height: 82vh;
    background: #0a1611;
    border-radius: 10px;
    border: 1px solid var(--line2);
  }
  .mapview .tlbl {
    fill: #06120c;
    font-size: 11px;
    font-weight: 700;
  }
  .mapview .tcond {
    fill: #eafff3;
    stroke: #05090a;
    stroke-width: 2.6;
    paint-order: stroke;
    stroke-linejoin: round;
    font-size: 10px;
    font-weight: 600;
  }
  figcaption {
    margin-top: 14px;
    color: var(--muted);
    font-style: italic;
  }

  .grid {
    display: grid;
    gap: 18px;
    width: 100%;
    max-width: 92vw;
    max-height: 84vh;
    align-content: center;
    justify-items: center;
  }
  .gcell {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
  }
  .gcell img {
    max-width: 100%;
    max-height: 60vh;
    border-radius: 10px;
    border: 1px solid var(--line2);
    object-fit: contain;
  }
  .gtext {
    text-align: center;
    padding: 8px 12px;
  }
  .gtext h2 {
    font-family: Georgia, serif;
    color: var(--green);
    font-size: clamp(18px, 2.6vw, 30px);
    margin-bottom: 8px;
  }
  .gtext p {
    font-size: clamp(13px, 1.7vw, 19px);
    line-height: 1.5;
  }

  .mood {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: background 0.8s ease;
    z-index: 1;
  }

  .ytplayer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    z-index: 2;
  }
  /* Sound-only: keep the iframe loaded/playing but invisible to players.
     Not display:none (that can stop playback) — push it offscreen at 1px. */
  .ytplayer.audioonly {
    inset: auto;
    left: -9999px;
    top: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

  .unlock {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    padding: 10px 18px;
    border-radius: 999px;
    border: 1px solid var(--green);
    background: rgba(9, 16, 13, 0.92);
    color: var(--green);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .unlock:hover {
    background: rgba(47, 138, 102, 0.2);
  }

  .ping {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border-radius: 50%;
    border: 3px solid var(--green);
    box-shadow: 0 0 18px var(--green);
    pointer-events: none;
    animation: pingpulse 1.5s ease-out forwards;
  }
  @keyframes pingpulse {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    25% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }

  /* Plain mode: flat, high-contrast framing for legibility over atmosphere. */
  .broadcast.plain {
    background: #05090a;
  }
  .broadcast.plain .card h1 {
    font-family: system-ui, sans-serif;
    color: var(--txt);
  }
  .broadcast.plain figure img,
  .broadcast.plain .gcell img {
    border-radius: 4px;
  }
  .broadcast.plain .gtext h2 {
    font-family: system-ui, sans-serif;
    color: var(--txt);
  }
  .broadcast.plain figcaption {
    font-style: normal;
  }
</style>
