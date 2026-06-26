<script lang="ts">
  import { onMount } from 'svelte';
  import { beats } from './store.svelte';

  onMount(() => void beats.load());
</script>

<div class="bp">
  <div class="head">
    <span class="lbl">Scene flow</span>
    <button class="btn" onclick={() => beats.add()}>+ Beat</button>
  </div>

  <ul class="cards">
    {#each beats.cards as b, i (b.id)}
      <li class="card">
        <span class="num">{i + 1}</span>
        <input class="title" bind:value={b.title} onchange={() => beats.rename(b.id, b.title)} />
        <div class="moves">
          <button class="mv" disabled={i === 0} onclick={() => beats.move(b.id, -1)} title="Up">▲</button>
          <button
            class="mv"
            disabled={i === beats.cards.length - 1}
            onclick={() => beats.move(b.id, 1)}
            title="Down">▼</button
          >
          <button class="del" onclick={() => beats.remove(b.id)} title="Remove">×</button>
        </div>
      </li>
    {:else}
      <li class="muted">No beats yet.</li>
    {/each}
  </ul>
</div>

<style>
  .bp {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lbl {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .btn {
    padding: 5px 10px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .num {
    color: var(--green);
    font-size: 12px;
    font-weight: 700;
    min-width: 14px;
  }
  .title {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--txt);
    font: inherit;
  }
  .moves {
    display: flex;
    gap: 2px;
  }
  .mv,
  .del {
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    cursor: pointer;
    border-radius: 6px;
    width: 22px;
    height: 22px;
    font-size: 10px;
    line-height: 1;
  }
  .del {
    font-size: 14px;
  }
  .mv:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .mv:not(:disabled):hover,
  .del:hover {
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
