<script lang="ts">
  import { roll, rollCardModel, type RollMode, type RollResult } from './logic';
  import { sendRollCard } from './bus-actions';
  import { t } from '../../lib/i18n';

  const DICE = [4, 6, 8, 10, 12, 20, 100];

  let mode = $state<RollMode>('normal');
  let result = $state<RollResult | null>(null);
  let expr = $state('');
  let lastSides = $state<number | null>(null);

  // Roll a single die of `sides`. adv/dis only applies to d20 (a d100 kept-high
  // would be wrong for CoC, where low rolls are good). Result is GM-side until aired.
  function rollDie(sides: number) {
    const e = `1d${sides}`;
    const r = roll(e, sides === 20 ? mode : 'normal');
    if (!r) return;
    result = r;
    expr = e;
    lastSides = sides;
  }

  // Push the current (GM-side) result onto the broadcast as a big card.
  function air() {
    if (!result) return;
    sendRollCard(rollCardModel(result, expr));
  }
</script>

<div class="res">
  <div class="num">{result ? result.total : '—'}</div>
  <div class="meta">
    {#if result}
      <div class="lbl">{expr}{expr === '1d20' && mode !== 'normal'
          ? ` · ${mode === 'advantage' ? t('roller.adv') : t('roller.dis')}`
          : ''}</div>
      {#if result.rolls.length > 1}
        <div class="sub">[{result.rolls.join(', ')}]</div>
      {/if}
    {:else}
      <div class="lbl faint">{t('roller.tapDie')}</div>
    {/if}
  </div>
  <button class="air" type="button" onclick={air} disabled={!result} title={t('roller.airThis')}>
    {t('roller.air')}
  </button>
</div>

<div class="tray" data-no-drag>
  {#each DICE as s (s)}
    <button class="die" class:hero={s === lastSides} type="button" onclick={() => rollDie(s)}>d{s}</button>
  {/each}
</div>

<div class="modes" data-no-drag>
  <div class="seg">
    <button class:on={mode === 'disadvantage'} type="button" onclick={() => (mode = 'disadvantage')}>{t('roller.dis')}</button>
    <button class:on={mode === 'normal'} type="button" onclick={() => (mode = 'normal')}>{t('roller.norm')}</button>
    <button class:on={mode === 'advantage'} type="button" onclick={() => (mode = 'advantage')}>{t('roller.adv')}</button>
  </div>
</div>

<style>
  .res {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg1);
    border: 1px solid var(--line2);
    border-radius: var(--r3);
    padding: 9px 12px;
    margin-bottom: 12px;
  }
  .num {
    font-family: var(--num);
    font-variant-numeric: tabular-nums;
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    color: var(--green);
    min-width: 52px;
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .lbl {
    font-size: 13px;
    color: var(--txt);
  }
  .lbl.faint {
    color: var(--faint);
  }
  .sub {
    font-size: 11px;
    color: var(--muted);
  }
  .air {
    background: var(--fill-g14);
    border: 1px solid var(--green);
    color: var(--green);
    border-radius: var(--r2);
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .air:hover {
    background: var(--fill-g22);
  }
  .air:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tray {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
    gap: 6px;
    margin-bottom: 11px;
  }
  .die {
    height: 44px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--fill-g08);
    color: var(--txt);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .die:hover {
    background: var(--fill-g22);
    border-color: var(--green);
  }
  .die:active {
    transform: scale(0.94);
  }
  .die.hero {
    background: var(--fill-g22);
    border-color: var(--green);
  }
  .modes {
    display: flex;
    justify-content: center;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--line2);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .seg button {
    background: transparent;
    border: 0;
    color: var(--muted);
    font-size: 12px;
    padding: 4px 14px;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--fill-g22);
    color: var(--green);
  }
</style>
