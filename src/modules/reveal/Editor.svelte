<script lang="ts">
  import type { BroadcastPayload } from '../../lib/types';
  import { putOnAir, clearBroadcast } from './bus-actions';

  let mode = $state<'text' | 'image'>('text');
  let title = $state('A Strange Symbol');
  let body = $state('Carved into the warehouse wall, still wet with brine.');
  let src = $state('');
  let caption = $state('');

  function send() {
    const payload: BroadcastPayload =
      mode === 'text' ? { kind: 'text', title, body } : { kind: 'image', src, caption };
    putOnAir(payload);
  }
</script>

<div class="editor">
  <header class="ehead">
    <h2>Reveal</h2>
    <div class="seg">
      <button class:on={mode === 'text'} onclick={() => (mode = 'text')}>Text</button>
      <button class:on={mode === 'image'} onclick={() => (mode = 'image')}>Image</button>
    </div>
  </header>

  {#if mode === 'text'}
    <input class="in" bind:value={title} placeholder="Title (optional)" />
    <textarea class="in" rows="5" bind:value={body} placeholder="Body text"></textarea>
  {:else}
    <input class="in" bind:value={src} placeholder="Image URL" />
    <input class="in" bind:value={caption} placeholder="Caption (optional)" />
  {/if}

  <div class="actions">
    <button class="btn solid" onclick={send}>Send to Broadcast</button>
    <button class="btn" onclick={clearBroadcast}>Clear</button>
  </div>
  <p class="muted hint">Screen-share the broadcast window; players see only what you send here.</p>
</div>

<style>
  .editor {
    padding: 22px 26px;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ehead {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ehead h2 {
    font-family: Georgia, serif;
    font-size: 22px;
    color: #e9f3ed;
  }
  .seg button {
    padding: 7px 14px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .seg button:first-child {
    border-radius: 8px 0 0 8px;
  }
  .seg button:last-child {
    border-radius: 0 8px 8px 0;
    border-left: 0;
  }
  .seg button.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
  }
  .in {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .hint {
    font-size: 12px;
  }
</style>
