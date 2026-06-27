<script lang="ts">
  import { onMount } from 'svelte';
  import { spotlight } from './store.svelte';
  import { t } from '../../lib/i18n';

  let draft = $state('');

  onMount(() => {
    void spotlight.load();
    // Keep "minutes ago" fresh while the widget is open.
    const t = setInterval(() => spotlight.refresh(), 30_000);
    return () => clearInterval(t);
  });

  function addPlayer() {
    const name = draft.trim();
    if (!name) return;
    spotlight.add(name);
    draft = '';
  }

  function ago(sinceMs: number): string {
    if (!isFinite(sinceMs)) return t('spotlight.never');
    const m = Math.floor(sinceMs / 60_000);
    return m < 1 ? t('spotlight.justNow') : `${m}${t('spotlight.minAgo')}`;
  }
</script>

<div class="sp">
  <div class="thr">
    <span class="muted">{t('spotlight.overdueAfter')}</span>
    <input class="num" type="number" min="1" bind:value={spotlight.thresholdMin} /> {t('spotlight.min')}
  </div>

  <ul class="list">
    {#each spotlight.rows as r (r.id)}
      <li class="row" class:overdue={r.overdue}>
        <span class="name">{r.name}</span>
        <span class="since">{ago(r.sinceMs)}</span>
        <button class="mark" onclick={() => spotlight.mark(r.id)}>{t('spotlight.spotlight')}</button>
        <button class="del" aria-label={t('spotlight.remove')} onclick={() => spotlight.remove(r.id)}>×</button>
      </li>
    {:else}
      <li class="muted">{t('spotlight.empty')}</li>
    {/each}
  </ul>

  <div class="add">
    <input
      class="in"
      placeholder={t('spotlight.addPlaceholder')}
      bind:value={draft}
      onkeydown={(e) => e.key === 'Enter' && addPlayer()}
    />
    <button class="btn" onclick={addPlayer}>{t('spotlight.add')}</button>
  </div>
</div>

<style>
  .sp {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }
  .thr {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .num {
    width: 48px;
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    flex: 1;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--line2);
    background: rgba(0, 0, 0, 0.18);
  }
  .row.overdue {
    border-left-color: var(--red);
  }
  .name {
    flex: 1;
    font-size: 13px;
    color: var(--txt);
  }
  .since {
    font-size: 11px;
    color: var(--muted);
  }
  .row.overdue .since {
    color: var(--red);
  }
  .mark {
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
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
  .add {
    display: flex;
    gap: 6px;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
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
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
