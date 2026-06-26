<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet } from '../lib/db';
  import type { BroadcastPayload, DisplayMode } from '../lib/types';
  import { DISPLAY_MODE_KEY, DEFAULT_DISPLAY_MODE, normalizeMode } from './display';

  let payload = $state<BroadcastPayload>({ kind: 'clear' });
  let mode = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  const CELL = 48; // viewBox cell size; aspect-ratio only, scales to fit

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
      if (m.type === 'broadcast') payload = m.payload;
      else mode = m.mode;
    });
    return () => {
      off();
      bus.close();
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
