<script lang="ts">
  import {
    roll,
    DEFAULT_MACROS,
    rollCardModel,
    trimHistory,
    type RollMode,
    type RollResult,
    type HistoryEntry,
  } from './logic';
  import { sendRollCard } from './bus-actions';
  import { t } from '../../lib/i18n';

  let expr = $state('1d20');
  let label = $state('');
  let mode = $state<RollMode>('normal');
  let hidden = $state(false);
  let result = $state<RollResult | null>(null);
  let error = $state(false);
  // Last-N roll log (newest first); public rolls can be re-aired from here.
  let history = $state<HistoryEntry[]>([]);

  function doRoll(e = expr): HistoryEntry | null {
    expr = e;
    const r = roll(e, mode, hidden);
    if (!r) {
      error = true;
      result = null;
      return null;
    }
    error = false;
    result = r;
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      expr: e,
      ...(label.trim() ? { label: label.trim() } : {}),
      result: r,
      at: Date.now(),
    };
    history = trimHistory(history, entry);
    return entry;
    // Hidden GM rolls are kept GM-side and are never sent to the broadcast bus.
  }

  // Roll and, if not hidden, air the result as a big card on the broadcast.
  function rollPublic() {
    const entry = doRoll();
    if (entry && !entry.result.hidden) air(entry);
  }

  // Re-air a past (non-hidden) roll as a broadcast card. Hidden entries are
  // never aired — the guard here backs up the GM-only invariant.
  function air(entry: HistoryEntry) {
    if (entry.result.hidden) return;
    sendRollCard(rollCardModel(entry.result, entry.expr, entry.label));
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
  <input class="in lbl" bind:value={label} aria-label={t('roller.label')} placeholder={t('roller.labelPlaceholder')} />
  <button class="btn air sm" type="button" onclick={rollPublic} title={t('roller.airThis')}>
    {t('roller.rollPublic')}
  </button>
</div>

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

<div class="hist" data-no-drag>
  <div class="hist-h">{t('roller.history')}</div>
  {#if history.length === 0}
    <div class="hist-empty">{t('roller.noHistory')}</div>
  {:else}
    <ul class="hist-list">
      {#each history as h (h.id)}
        <li class="hist-row">
          <span class="hist-expr">{h.label ? `${h.label}: ` : ''}{h.expr}</span>
          <span class="hist-total">{h.result.total}</span>
          {#if h.result.hidden}
            <span class="hid">{t('roller.hiddenNoAir')}</span>
          {:else}
            <button class="chip reair" type="button" onclick={() => air(h)}>{t('roller.reair')}</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
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
  .lbl {
    flex: 1;
    font-size: 12px;
  }
  .btn.air {
    background: rgba(47, 138, 102, 0.18);
    border: 1px solid var(--green);
    color: var(--green);
    border-radius: 7px;
    padding: 5px 11px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn.air:hover {
    background: rgba(47, 138, 102, 0.3);
  }
  .hist {
    margin-top: 12px;
    border-top: 1px solid var(--line2);
    padding-top: 8px;
  }
  .hist-h {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .hist-empty {
    font-size: 12px;
    color: var(--faint);
  }
  .hist-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hist-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .hist-expr {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--txt);
  }
  .hist-total {
    font-weight: 700;
    color: var(--green);
  }
  .reair {
    padding: 2px 8px;
    font-size: 11px;
  }
</style>
