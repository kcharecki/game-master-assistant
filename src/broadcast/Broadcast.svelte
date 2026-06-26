<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet } from '../lib/db';
  import type { BroadcastPayload, DisplayMode } from '../lib/types';
  import { DISPLAY_MODE_KEY, DEFAULT_DISPLAY_MODE, normalizeMode } from './display';

  let payload = $state<BroadcastPayload>({ kind: 'clear' });
  let mode = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  // Transient ping marker (normalized 0..1) that overlays current content.
  let ping = $state<{ x: number; y: number } | null>(null);
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  const CELL = 48; // viewBox cell size; aspect-ratio only, scales to fit

  function flashPing(x: number, y: number) {
    ping = { x, y };
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => (ping = null), 1500);
  }

  onMount(() => {
    // Rehydrate last shared state + display mode, then listen for live GM pushes.
    void kvGet<BroadcastPayload>('broadcastState').then((saved) => {
      if (saved) payload = saved;
    });
    void kvGet<unknown>(DISPLAY_MODE_KEY).then((saved) => {
      mode = normalizeMode(saved);
    });
    const bus = createBus();
    const off = bus.on((m) => {
      if (m.type === 'display') mode = m.mode;
      else if (m.payload.kind === 'ping') flashPing(m.payload.x, m.payload.y);
      else payload = m.payload;
    });
    return () => {
      off();
      bus.close();
      clearTimeout(pingTimer);
    };
  });
</script>

<div class="broadcast" class:plain={mode === 'plain'}>
  {#if payload.kind === 'text'}
    <div class="card">
      {#if payload.title}<h1>{payload.title}</h1>{/if}
      <p>{payload.body}</p>
    </div>
  {:else if payload.kind === 'image'}
    <figure>
      {#if payload.src}<img src={payload.src} alt={payload.caption ?? ''} />{/if}
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
  {:else}
    <div class="idle">Awaiting the Keeper…</div>
  {/if}

  {#if ping}
    <div class="ping" style="left:{ping.x * 100}%; top:{ping.y * 100}%"></div>
  {/if}
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
  .broadcast.plain figure img {
    border-radius: 4px;
  }
  .broadcast.plain figcaption {
    font-style: normal;
  }
</style>
