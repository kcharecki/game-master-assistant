<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet } from '../lib/db';
  import type { BroadcastPayload } from '../lib/types';

  let payload = $state<BroadcastPayload>({ kind: 'clear' });

  onMount(() => {
    // Rehydrate last shared state, then listen for live GM pushes.
    void kvGet<BroadcastPayload>('broadcastState').then((saved) => {
      if (saved) payload = saved;
    });
    const bus = createBus();
    const off = bus.on((m) => (payload = m.payload));
    return () => {
      off();
      bus.close();
    };
  });
</script>

<div class="broadcast">
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
  figcaption {
    margin-top: 14px;
    color: var(--muted);
    font-style: italic;
  }
</style>
