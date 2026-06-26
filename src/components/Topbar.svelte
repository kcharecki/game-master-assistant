<script lang="ts">
  import { onMount } from 'svelte';
  import { system } from '../lib/stores/system.svelte';
  import { SYSTEMS, systemConfig } from '../lib/system';

  let { onOpenBroadcast }: { onOpenBroadcast: () => void } = $props();

  onMount(() => {
    void system.load();
  });
</script>

<header class="topbar">
  <div class="brand">GM Assistant<small>CTHULHU EDITION</small></div>
  <span class="pill">The Haunting of Blackwater Creek</span>
  <span class="spacer"></span>
  <div class="sysswitch" role="group" aria-label="Game system">
    {#each SYSTEMS as s (s)}
      <button
        class="sysbtn"
        class:on={system.current === s}
        aria-pressed={system.current === s}
        onclick={() => system.set(s)}>{systemConfig(s).label}</button
      >
    {/each}
  </div>
  <span class="pill">Session 02:34:17</span>
  <button class="btn" onclick={onOpenBroadcast}>Open Broadcast ↗</button>
</header>

<style>
  .sysswitch {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
  }
  .sysbtn {
    padding: 4px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .sysbtn:hover {
    color: var(--txt);
  }
  .sysbtn.on {
    background: rgba(47, 138, 102, 0.22);
    color: var(--txt);
  }
</style>
