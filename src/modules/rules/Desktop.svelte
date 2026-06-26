<script lang="ts">
  import { rules } from './store.svelte';
  import { system } from '../../lib/stores/system.svelte';
  import { systemConfig } from '../../lib/system';
</script>

<div class="rl">
  <input class="in" placeholder="Look up a rule…" bind:value={rules.query} />
  <div class="sys muted">{systemConfig(system.current).label} rules</div>

  <ul class="list">
    {#each rules.results as r (r.id)}
      <li class="row">
        <div class="term">
          {r.term}
          {#if r.system === 'both'}<span class="tag">core</span>{/if}
        </div>
        <p class="body">{r.body}</p>
      </li>
    {:else}
      <li class="muted">No matching rules.</li>
    {/each}
  </ul>
</div>

<style>
  .rl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    overflow: hidden;
  }
  .in {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .sys {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    flex: 1;
  }
  .row {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .term {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--green);
  }
  .tag {
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid var(--line2);
    border-radius: 5px;
    padding: 1px 5px;
  }
  .body {
    margin: 3px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--txt);
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
