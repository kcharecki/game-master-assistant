<script lang="ts">
  import { initiative } from './store.svelte';

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
</script>

<div class="initbar">
  <span class="rnd">Round {initiative.round}</span>
  <button class="btn solid sm" onclick={() => initiative.nextTurn()}>Next ▸</button>
</div>

{#each initiative.order as c, i (c.id)}
  <div class="combatant" class:active={i === initiative.active} class:foe={c.foe}>
    <span class="av">{initials(c.name)}</span>
    <span class="cn"><div class="nm">{c.name}</div><div class="rl">{c.role}</div></span>
    <span class="iv">{c.init}</span>
    <span class="ord" data-no-drag>
      <button class="ob" onclick={() => initiative.moveUp(c.id)} aria-label="Move up">▲</button>
      <button class="ob" onclick={() => initiative.moveDown(c.id)} aria-label="Move down">▼</button>
      <button class="ob x" onclick={() => initiative.remove(c.id)} aria-label="Remove">✕</button>
    </span>
  </div>
{/each}

<button class="btn sm add" onclick={() => initiative.add()}>＋ Combatant</button>

<style>
  .initbar {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .rnd {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .btn.sm {
    margin-left: auto;
    padding: 5px 11px;
    font-size: 12px;
  }
  .btn.add {
    margin-top: 6px;
  }
  .ord {
    display: flex;
    gap: 2px;
  }
  .ob {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    line-height: 1;
    font-size: 10px;
  }
  .ob:hover {
    color: var(--txt);
    background: rgba(95, 150, 120, 0.14);
  }
  .ob.x:hover {
    color: #fff;
    background: #7a2a2a;
  }
</style>
