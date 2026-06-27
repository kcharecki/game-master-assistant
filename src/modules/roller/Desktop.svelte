<script lang="ts">
  import { roll, DEFAULT_MACROS, type RollMode, type RollResult } from './logic';
  import { t } from '../../lib/i18n';

  let expr = $state('1d20');
  let mode = $state<RollMode>('normal');
  let hidden = $state(false);
  let result = $state<RollResult | null>(null);
  let error = $state(false);

  function doRoll(e = expr) {
    expr = e;
    const r = roll(e, mode, hidden);
    if (!r) {
      error = true;
      result = null;
      return;
    }
    error = false;
    result = r;
    // Hidden GM rolls are kept GM-side and are never sent to the broadcast bus.
  }
</script>

<div class="diebox">
  <div class="dt">{expr}{mode !== 'normal'
      ? ` · ${mode === 'advantage' ? t('roller.adv') : t('roller.dis')}`
      : ''}</div>
  <div class="dn">{result ? result.total : '—'}</div>
  <div class="ds">
    {#if error}
      <span class="err">{t('roller.badExpr')}</span>
    {:else if result}
      [{result.kept.join(', ')}]{result.modifier
        ? (result.modifier > 0 ? ' +' : ' ') + result.modifier
        : ''}
      {#if result.hidden}<span class="hid">{t('roller.hiddenTag')}</span>{/if}
    {:else}
      {t('roller.enterRoll')}
    {/if}
  </div>
</div>

<div class="macros" data-no-drag>
  {#each DEFAULT_MACROS as m (m.id)}
    <button class="chip" onclick={() => doRoll(m.expr)}>{m.label}</button>
  {/each}
</div>

<form class="add-row" data-no-drag onsubmit={(ev) => (ev.preventDefault(), doRoll())}>
  <input class="in" bind:value={expr} aria-label={t('roller.expr')} placeholder={t('roller.exprPlaceholder')} />
  <button class="btn solid sm" type="submit">{t('roller.roll')}</button>
</form>

<div class="opts" data-no-drag>
  <select class="in sel" bind:value={mode} aria-label={t('roller.mode')}>
    <option value="normal">{t('roller.normal')}</option>
    <option value="advantage">{t('roller.advantage')}</option>
    <option value="disadvantage">{t('roller.disadvantage')}</option>
  </select>
  <label class="hidchk">
    <input type="checkbox" bind:checked={hidden} /> {t('roller.hidden')}
  </label>
</div>

<style>
  .macros {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 10px;
  }
  .chip {
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid var(--line2);
    background: rgba(47, 138, 102, 0.1);
    color: var(--txt);
    cursor: pointer;
  }
  .chip:hover {
    background: rgba(47, 138, 102, 0.2);
  }
  .add-row {
    display: flex;
    gap: 6px;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 7px 9px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .btn.sm {
    padding: 5px 13px;
    font-size: 13px;
  }
  .opts {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 9px;
  }
  .sel {
    flex: 1;
  }
  .hidchk {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .err {
    color: var(--red);
  }
  .hid {
    color: var(--gold);
  }
</style>
