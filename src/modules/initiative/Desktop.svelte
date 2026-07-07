<script lang="ts">
  import { initiative, isBloodied, vagueStatus } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

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

{#if initiative.order.length === 0}
  <Empty
    text={t('initiative.empty')}
    actionLabel={t('initiative.addCombatant')}
    onAction={() => initiative.add()}
  />
{/if}

{#each initiative.order as c, i (c.id)}
  <div class="combatant" class:active={i === initiative.active} class:foe={c.foe}>
    <span class="av">{initials(c.name)}</span>
    <span class="cn" data-no-drag>
      <div class="nm">
        <input
          class="nm-in"
          value={c.name}
          oninput={(e) => initiative.set(c.id, { name: e.currentTarget.value })}
          aria-label={t('initiative.name')}
        />
        {#if isBloodied(c)}<span class="blood" title={t('initiative.bloodied')}>●</span>{/if}
        {#if c.hidden}<span class="hid" title={t('initiative.hiddenHp')}>◐</span>{/if}
      </div>
      <div class="rl">
        <input
          class="num hp-in"
          class:low={isBloodied(c)}
          type="number"
          value={c.hp}
          oninput={(e) => initiative.set(c.id, { hp: e.currentTarget.valueAsNumber || 0 })}
          aria-label={t('initiative.hp')}
        />/<input
          class="num"
          type="number"
          value={c.maxHp}
          oninput={(e) => initiative.set(c.id, { maxHp: e.currentTarget.valueAsNumber || 0 })}
          aria-label={t('initiative.maxHp')}
        />
        · AC <input
          class="num"
          type="number"
          value={c.ac}
          oninput={(e) => initiative.set(c.id, { ac: e.currentTarget.valueAsNumber || 0 })}
          aria-label={t('initiative.ac')}
        />
        {#if c.hidden}<span class="vague" title={vagueStatus(c)}>({vagueStatus(c)})</span>{/if}
        {#if c.conditions.length}
          · <span class="cond">{c.conditions.join(', ')}</span>
        {/if}
      </div>
    </span>
    <input
      class="num iv-in"
      type="number"
      value={c.init}
      oninput={(e) => initiative.set(c.id, { init: e.currentTarget.valueAsNumber || 0 })}
      aria-label={t('initiative.init')}
    />
    <span class="ord" data-no-drag>
      <button class="ob" onclick={() => initiative.damage(c.id, 1)} aria-label={t('initiative.damage1')}>−</button>
      <button class="ob" onclick={() => initiative.heal(c.id, 1)} aria-label={t('initiative.heal1')}>+</button>
      <button class="ob" onclick={() => initiative.toggleHidden(c.id)} aria-label={t('initiative.toggleHidden')}
        >◐</button
      >
      <button class="ob" onclick={() => initiative.moveUp(c.id)} aria-label={t('initiative.moveUp')}>▲</button>
      <button class="ob" onclick={() => initiative.moveDown(c.id)} aria-label={t('initiative.moveDown')}>▼</button>
      <button class="ob x" onclick={() => initiative.remove(c.id)} aria-label={t('initiative.remove')} title={t('initiative.remove')}><Icon name="close" size={12} /></button>
    </span>
  </div>
{/each}

<button class="btn sm add" onclick={() => initiative.add()}
  ><Icon name="plus" /> {t('initiative.addCombatant')}</button
>

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
  .nm-in {
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    padding: 1px 3px;
    border-radius: var(--r1);
    width: 12ch;
    min-width: 0;
  }
  .nm-in:hover,
  .nm-in:focus {
    border-color: var(--line2);
    background: var(--fill-g08);
    outline: none;
  }
  .num {
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0 2px;
    border-radius: var(--r1);
    width: 3.2ch;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .num::-webkit-outer-spin-button,
  .num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .num:hover,
  .num:focus {
    border-color: var(--line2);
    background: var(--fill-g08);
    outline: none;
  }
  .hp-in.low {
    color: var(--red);
    font-weight: 600;
  }
  .iv-in {
    color: var(--green);
    font-weight: 600;
    width: 3.5ch;
  }
  .vague {
    color: var(--green);
    font-style: italic;
    font-size: 11px;
  }
  .blood {
    color: var(--red);
    font-size: 10px;
  }
  .hid {
    color: var(--green);
    font-size: 10px;
  }
  .cond {
    color: var(--green);
  }
  .ord {
    display: flex;
    gap: 2px;
  }
  .ob {
    width: 20px;
    height: 20px;
    border-radius: var(--r1);
    border: 1px solid transparent;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    line-height: 1;
    font-size: 10px;
  }
  .ob:hover {
    color: var(--txt);
    background: var(--fill-g14);
  }
  .ob.x:hover {
    color: var(--ink);
    background: var(--fill-red);
  }
</style>
