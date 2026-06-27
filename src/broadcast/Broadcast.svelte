<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet, assetUrl } from '../lib/db';
  import type { BroadcastPayload, DisplayMode } from '../lib/types';
  import { DISPLAY_MODE_KEY, DEFAULT_DISPLAY_MODE, normalizeMode } from './display';
  import { MOOD_KEY, DEFAULT_MOOD, moodById, normalizeMood, moodStyle, type Mood } from './mood';
  import { clampCols, gridAssetIds } from './grid';

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
    const el = cue.channel === 'ambient' ? ambientEl : sfxEl;
    if (!el) return;
    if (cue.action === 'stop') {
      el.pause();
      if (cue.channel === 'ambient' && ambientUrl) {
        URL.revokeObjectURL(ambientUrl);
        ambientUrl = '';
      }
      return;
    }
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
    const off = bus.on((m) => {
      if (m.type === 'display') mode = m.mode;
      else if (m.type === 'mood') mood = moodById(m.moodId);
      else if (m.payload.kind === 'ping') flashPing(m.payload.x, m.payload.y);
      else if (m.payload.kind === 'audio') handleAudio(m.payload);
      else payload = m.payload;
    });
    return () => {
      off();
      bus.close();
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
    <div class="mapview">
      <svg
        viewBox="0 0 {(payload.reveal[0]?.length ?? 0) * CELL} {payload.reveal.length * CELL}"
        preserveAspectRatio="xMidYMid meet"
      >
        {#if payload.src}
          <image href={payload.src} x="0" y="0" width="100%" height="100%" />
        {/if}
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
  {:else}
    <div class="idle">Awaiting the Keeper…</div>
  {/if}

  <!-- Mood/lighting wash, layered over content but under transient markers. -->
  <div class="mood" style="background:{mstyle.overlay}"></div>

  {#if ping}
    <div class="ping" style="left:{ping.x * 100}%; top:{ping.y * 100}%"></div>
  {/if}

  {#if audioLocked}
    <button class="unlock" onclick={unlockAudio}>🔊 Click to enable audio</button>
  {/if}

  <!-- Audio routed through this shared tab; hidden, GM-controlled via the bus. -->
  <audio bind:this={ambientEl}></audio>
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
