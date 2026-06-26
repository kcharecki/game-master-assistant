<script lang="ts">
  import type { WindowKind } from '../lib/types';
  import { moduleList } from '../lib/registry';

  let {
    onReveal,
    onAdd,
  }: { onReveal: () => void; onAdd: (kind: WindowKind) => void } = $props();

  let menuOpen = $state(false);

  // Only modules with a live desktop view make sense as spawnable windows.
  const spawnable = moduleList.filter((m) => m.desktop);

  function spawn(kind: WindowKind) {
    onAdd(kind);
    menuOpen = false;
  }
</script>

<div class="dock">
  <button class="di"><b>Narrate</b></button>
  <button class="di" onclick={onReveal}><b>Reveal</b></button>
  <button class="di" onclick={() => onAdd('npcs')}><b>Add NPC</b></button>
  <button class="di" onclick={() => onAdd('roller')}><b>Roll</b></button>
  <button class="di" onclick={() => onAdd('timer')}><b>Timer</b></button>
  <button class="di" onclick={() => onAdd('conditions')}><b>Conditions</b></button>
  <div class="sep"></div>
  <div class="widget-wrap">
    {#if menuOpen}
      <div class="menu" role="menu">
        {#each spawnable as m (m.id)}
          <button class="mi" role="menuitem" onclick={() => spawn(m.id)}>{m.title}</button>
        {/each}
      </div>
    {/if}
    <button
      class="di add"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}><b>＋ Widget</b></button
    >
  </div>
</div>

<style>
  .widget-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    bottom: 54px;
    right: 0;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.96);
    backdrop-filter: blur(9px);
    box-shadow: 0 16px 44px -16px rgba(0, 0, 0, 0.9);
  }
  .mi {
    text-align: left;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font-size: 13px;
  }
  .mi:hover {
    background: rgba(47, 138, 102, 0.16);
    border-color: var(--green-dim);
  }
</style>
