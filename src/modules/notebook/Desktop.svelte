<script lang="ts">
  import { onMount } from 'svelte';
  import { notebook } from './store.svelte';

  onMount(() => void notebook.load());

  let draft = $state('');

  function submit() {
    if (notebook.add(draft)) draft = '';
  }

  function fmt(at: number): string {
    return new Date(at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="nb">
  <div class="add">
    <input
      class="in"
      placeholder="Note… use #tags"
      bind:value={draft}
      onkeydown={(e) => e.key === 'Enter' && submit()}
    />
    <button class="btn" onclick={submit}>Add</button>
  </div>

  <div class="filters">
    <input class="in search" placeholder="Search…" bind:value={notebook.query} />
    <button class="btn" onclick={() => notebook.makeRecap()}>Recap</button>
    {#if notebook.tags.length}
      <div class="tags">
        {#each notebook.tags as t (t)}
          <button
            class="chip"
            class:on={notebook.activeTag === t}
            onclick={() => notebook.setTag(t)}>#{t}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  {#if notebook.recap}
    <div class="recap">
      <button class="rclose" title="Dismiss" onclick={() => (notebook.recap = null)}>×</button>
      <pre>{notebook.recap}</pre>
    </div>
  {/if}

  <ul class="list">
    {#each notebook.visible as n (n.id)}
      <li class="note">
        <div class="meta">
          <span class="time">{fmt(n.at)}</span>
          <button class="del" title="Delete" onclick={() => notebook.remove(n.id)}>×</button>
        </div>
        <p class="body">{n.body}</p>
      </li>
    {:else}
      <li class="muted">No notes.</li>
    {/each}
  </ul>
</div>

<style>
  .nb {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .add,
  .filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
  }
  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .chip.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .recap {
    position: relative;
    border: 1px solid var(--green-dim);
    border-radius: 8px;
    background: rgba(47, 138, 102, 0.1);
    padding: 8px 26px 8px 10px;
  }
  .recap pre {
    margin: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .rclose {
    position: absolute;
    top: 4px;
    right: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
  }
  .note {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .time {
    color: var(--muted);
    font-size: 11px;
  }
  .del {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
  }
  .del:hover {
    color: var(--txt);
  }
  .body {
    margin: 2px 0 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
