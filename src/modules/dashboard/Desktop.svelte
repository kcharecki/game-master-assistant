<script lang="ts">
  import { onMount } from 'svelte';
  import { dashboard } from './store.svelte';
  import { t } from '../../lib/i18n';

  onMount(() => void dashboard.load());

  function num(e: Event): number {
    return Number((e.currentTarget as HTMLInputElement).value) || 0;
  }
</script>

<div class="db">
  <div class="hint muted">{t('dashboard.partyRef')} {dashboard.topPP}</div>
  <div class="rows">
    {#each dashboard.sorted as p (p.id)}
      <div class="row">
        <input
          class="name"
          value={p.name}
          oninput={(e) => dashboard.update(p.id, { name: (e.currentTarget as HTMLInputElement).value })}
        />
        <label class="stat">AC<input type="number" value={p.ac} oninput={(e) => dashboard.update(p.id, { ac: num(e) })} /></label>
        <label class="stat">PP<input type="number" value={p.pp} oninput={(e) => dashboard.update(p.id, { pp: num(e) })} /></label>
        <button class="del" aria-label={t('dashboard.remove')} onclick={() => dashboard.remove(p.id)}>×</button>
        <input
          class="meta"
          value={p.saves ?? ''}
          placeholder={t('dashboard.savesPlaceholder')}
          oninput={(e) => dashboard.update(p.id, { saves: (e.currentTarget as HTMLInputElement).value })}
        />
        <input
          class="meta"
          value={p.resistances ?? ''}
          placeholder={t('dashboard.resistPlaceholder')}
          oninput={(e) => dashboard.update(p.id, { resistances: (e.currentTarget as HTMLInputElement).value })}
        />
      </div>
    {/each}
  </div>
  <button class="btn" onclick={() => dashboard.add()}>{t('dashboard.addPc')}</button>
</div>

<style>
  .db {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .hint {
    font-size: 11px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    flex: 1;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 4px 6px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .name {
    grid-column: 1;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
  }
  .stat input {
    width: 40px;
    padding: 3px 4px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .del {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
  }
  .del:hover {
    color: var(--txt);
  }
  .meta {
    grid-column: 1 / -1;
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.18);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
  }
  .btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
</style>
