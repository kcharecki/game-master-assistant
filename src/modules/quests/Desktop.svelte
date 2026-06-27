<script lang="ts">
  import { onMount } from 'svelte';
  import { quests } from './store.svelte';
  import type { QuestStatus } from './logic';
  import { t } from '../../lib/i18n';

  onMount(() => void quests.load());

  let clueDraft = $state<Record<string, string>>({});

  function addClue(id: string) {
    const v = clueDraft[id] ?? '';
    quests.addClue(id, v);
    clueDraft[id] = '';
  }

  const groups: { status: QuestStatus; labelKey: string }[] = [
    { status: 'open', labelKey: 'quests.groupOpen' },
    { status: 'resolved', labelKey: 'quests.groupResolved' },
  ];
</script>

<div class="q">
  <div class="head">
    <span class="tally">{quests.counts.open} {t('quests.open')}{t('quests.tallySep')}{quests.counts.resolved} {t('quests.resolved')}</span>
    <button class="btn" onclick={() => quests.add()}>{t('quests.addThread')}</button>
  </div>

  {#each groups as g (g.status)}
    <div class="group">
      <h4 class="gh">{t(g.labelKey)}</h4>
      {#each quests.group(g.status) as q (q.id)}
        <div class="card" class:done={q.status === 'resolved'}>
          <div class="top">
            <input class="title" bind:value={q.title} onchange={() => quests.update(q.id, { title: q.title })} />
            <button class="del" title={t('quests.delete')} aria-label={t('quests.deleteQuest')} onclick={() => quests.remove(q.id)}>×</button>
          </div>
          {#if q.clues.length}
            <ul class="clues">
              {#each q.clues as c, i (i)}<li>{c}</li>{/each}
            </ul>
          {/if}
          <div class="row">
            <input
              class="cin"
              placeholder={t('quests.addClue')}
              bind:value={clueDraft[q.id]}
              onkeydown={(e) => e.key === 'Enter' && addClue(q.id)}
            />
            <button class="lnk" onclick={() => quests.toggleStatus(q.id)}>
              {q.status === 'open' ? t('quests.resolve') : t('quests.reopen')}
            </button>
          </div>
        </div>
      {:else}
        <p class="muted">{t('quests.none')}</p>
      {/each}
    </div>
  {/each}
</div>

<style>
  .q {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tally {
    color: var(--muted);
    font-size: 12px;
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
  .lnk {
    padding: 3px 8px;
    font-size: 11px;
  }
  .gh {
    margin: 4px 0 2px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: rgba(0, 0, 0, 0.18);
  }
  .card.done {
    opacity: 0.62;
  }
  .top {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .title {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--txt);
    font: inherit;
    font-weight: 600;
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
  .clues {
    margin: 4px 0;
    padding-left: 16px;
    font-size: 12px;
    color: var(--txt);
  }
  .row {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .cin {
    flex: 1;
    min-width: 0;
    padding: 4px 7px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    margin: 2px 0;
  }
</style>
