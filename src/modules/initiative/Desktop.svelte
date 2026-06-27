<script lang="ts">
  import { initiative, isBloodied, vagueStatus } from './store.svelte';
  import { t } from '../../lib/i18n';

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
  <span class="rnd">{t('initiative.round')} {initiative.round}</span>
  <button class="btn solid sm" onclick={() => initiative.nextTurn()}>{t('initiative.nextTurn')}</button>
</div>

{#each initiative.order as c, i (c.id)}
  <div class="combatant" class:active={i === initiative.active} class:foe={c.foe}>
    <span class="av">{initials(c.name)}</span>
    <span class="cn">
      <div class="nm">
        {c.name}
        {#if isBloodied(c)}<span class="blood" title={t('initiative.bloodied')}>●</span>{/if}
        {#if c.hidden}<span class="hid" title={t('initiative.hiddenHp')}>◐</span>{/if}
      </div>
      <div class="rl">
        {#if c.hidden}
          {vagueStatus(c)}
        {:else}
          <span class="hp" class:low={isBloodied(c)}>{c.hp}/{c.maxHp}</span> · AC {c.ac}
        {/if}
        {#if c.conditions.length}
          · <span class="cond">{c.conditions.join(', ')}</span>
        {/if}
      </div>
    </span>
    <span class="iv">{c.init}</span>
    <span class="ord" data-no-drag>
      <button class="ob" onclick={() => initiative.damage(c.id, 1)} aria-label={t('initiative.damage1')}>−</button>
      <button class="ob" onclick={() => initiative.heal(c.id, 1)} aria-label={t('initiative.heal1')}>+</button>
      <button class="ob" onclick={() => initiative.toggleHidden(c.id)} aria-label={t('initiative.toggleHidden')}
        >◐</button
      >
      <button class="ob" onclick={() => initiative.moveUp(c.id)} aria-label={t('initiative.moveUp')}>▲</button>
      <button class="ob" onclick={() => initiative.moveDown(c.id)} aria-label={t('initiative.moveDown')}>▼</button>
      <button class="ob x" onclick={() => initiative.remove(c.id)} aria-label={t('initiative.remove')}>✕</button>
    </span>
  </div>
{/each}

<button class="btn sm add" onclick={() => initiative.add()}>{t('initiative.addCombatant')}</button>

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
  .hp.low {
    color: var(--red);
    font-weight: 600;
  }
  .blood {
    color: var(--red);
    font-size: 10px;
  }
  .hid {
    color: var(--gold);
    font-size: 10px;
  }
  .cond {
    color: var(--gold);
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
