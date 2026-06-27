<script lang="ts">
  import { onMount } from 'svelte';
  import { archive } from './store.svelte';
  import { notebook } from '../notebook/store.svelte';
  import { t } from '../../lib/i18n';

  onMount(() => {
    void archive.load();
    void notebook.load();
  });

  let sTitle = $state('');

  function addSession() {
    if (archive.addSession(sTitle)) sTitle = '';
  }

  function fmt(at: number): string {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="arc">
  <input class="in" placeholder={t('archive.searchAll')} bind:value={archive.query} />

  <ul class="list">
    {#each archive.results as e (e.id)}
      <li class="row {e.source}">
        <div class="meta">
          <span class="src">{e.source}</span>
          <span class="time">{fmt(e.at)}</span>
        </div>
        <p class="body">{e.text}</p>
      </li>
    {:else}
      <li class="muted">{t('archive.noHistory')}</li>
    {/each}
  </ul>

  <div class="add">
    <input
      class="in"
      placeholder={t('archive.logPlaceholder')}
      bind:value={sTitle}
      onkeydown={(e) => e.key === 'Enter' && addSession()}
    />
    <button class="btn" onclick={addSession}>{t('archive.log')}</button>
  </div>
</div>

<style>
  .arc {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
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
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    flex: 1;
  }
  .row {
    border: 1px solid var(--line);
    border-left: 3px solid var(--line2);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .row.session {
    border-left-color: var(--green-dim);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .src {
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .time {
    color: var(--muted);
    font-size: 11px;
  }
  .body {
    margin: 2px 0 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .add {
    display: flex;
    gap: 6px;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
</style>
