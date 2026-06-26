<script lang="ts">
  import { onMount } from 'svelte';
  import { lore } from './store.svelte';

  onMount(() => void lore.load());

  const sel = $derived(lore.selected);
  const backs = $derived(sel ? lore.backlinksOf(sel.id) : []);
</script>

<div class="lore">
  <select class="pick" value={lore.selectedId} onchange={(e) => lore.select(e.currentTarget.value)}>
    {#each lore.pages as p (p.id)}<option value={p.id}>{p.title || 'Untitled'}</option>{/each}
  </select>

  {#if sel}
    <p class="body">{sel.body || 'No content yet.'}</p>
    {#if backs.length}
      <div class="backs">
        <span class="lbl">Backlinks:</span>
        {#each backs as b (b.id)}<button class="chip" onclick={() => lore.select(b.id)}>{b.title}</button>{/each}
      </div>
    {/if}
  {:else}
    <p class="muted">No pages.</p>
  {/if}
</div>

<style>
  .lore {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: auto;
  }
  .pick {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .body {
    font-size: 13px;
    line-height: 1.5;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .backs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .lbl {
    color: var(--muted);
    font-size: 12px;
  }
  .chip {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
</style>
