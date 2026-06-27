<script lang="ts">
  import { onMount } from 'svelte';
  import { tables } from './store.svelte';
  import { system } from '../../lib/stores/system.svelte';
  import { t } from '../../lib/i18n';

  onMount(() => void tables.load());

  type Tab = 'tables' | 'loot' | 'rulings';
  let tab = $state<Tab>('tables');

  let entryDraft = $state<Record<string, string>>({});
  let q = $state('');
  let r = $state('');

  function addEntry(id: string) {
    tables.addEntry(id, entryDraft[id] ?? '');
    entryDraft[id] = '';
  }
  function addRuling() {
    tables.addRuling(q, r);
    if (q.trim() && r.trim()) {
      q = '';
      r = '';
    }
  }
</script>

<div class="tb">
  <div class="tabs">
    <button class:on={tab === 'tables'} onclick={() => (tab = 'tables')}>{t('tables.tables')}</button>
    <button class:on={tab === 'loot'} onclick={() => (tab = 'loot')}>{t('tables.loot')}</button>
    <button class:on={tab === 'rulings'} onclick={() => (tab = 'rulings')}>{t('tables.rulings')}</button>
  </div>

  {#if tables.lastRoll}<div class="result">{tables.lastRoll}</div>{/if}

  {#if tab === 'tables'}
    <div class="head">
      <span class="lbl">{t('tables.randomTables')}</span>
      <button class="btn" onclick={() => tables.addTable()}>{t('tables.addTable')}</button>
    </div>
    {#each tables.tables as tbl (tbl.id)}
      <div class="card">
        <div class="top">
          <b>{tbl.name}</b>
          <span class="actions">
            <button class="lnk" disabled={!tbl.entries.length} onclick={() => tables.roll(tbl.id)}>{t('tables.roll')}</button>
            <button class="del" aria-label={t('tables.deleteTable')} onclick={() => tables.removeTable(tbl.id)}>×</button>
          </span>
        </div>
        <div class="small">{tbl.entries.length}{t('tables.entriesSuffix')}</div>
        <div class="row">
          <input
            class="in"
            placeholder={t('tables.addEntry')}
            bind:value={entryDraft[tbl.id]}
            onkeydown={(e) => e.key === 'Enter' && addEntry(tbl.id)}
          />
        </div>
      </div>
    {/each}
  {:else if tab === 'loot'}
    <p class="lbl">{t('tables.lootGenPre')}{system.current === 'coc7e' ? t('tables.lootCoc') : t('tables.lootDnd')}{t('tables.lootGenPost')}</p>
    <button class="btn wide" onclick={() => tables.rollLoot(system.current)}>{t('tables.generateLoot')}</button>
  {:else}
    <div class="head"><span class="lbl">{t('tables.rulingsLog')}</span></div>
    <div class="form">
      <input class="in" placeholder={t('tables.questionPlaceholder')} bind:value={q} />
      <input class="in" placeholder={t('tables.rulingPlaceholder')} bind:value={r} />
      <button class="btn" onclick={addRuling}>{t('tables.log')}</button>
    </div>
    <ul class="list">
      {#each tables.rulings as rl (rl.id)}
        <li class="card">
          <div class="top"><b>{rl.question}</b><button class="del" aria-label={t('tables.deleteRuling')} onclick={() => tables.removeRuling(rl.id)}>×</button></div>
          <div class="small ans">{rl.ruling}</div>
        </li>
      {:else}
        <li class="small">{t('tables.noRulings')}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tb {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: auto;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    flex: 1;
    padding: 5px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .result {
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: rgba(47, 138, 102, 0.12);
    color: var(--txt);
    font-size: 13px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lbl {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  .btn,
  .lnk {
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
    border-radius: 7px;
  }
  .btn {
    padding: 5px 10px;
    font-size: 12px;
  }
  .btn.wide {
    width: 100%;
    padding: 8px;
  }
  .lnk {
    padding: 3px 8px;
    font-size: 11px;
  }
  .lnk:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .small {
    color: var(--muted);
    font-size: 12px;
  }
  .ans {
    color: var(--txt);
    margin-top: 2px;
  }
  .row,
  .form {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .form {
    flex-wrap: wrap;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 5px 7px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
</style>
