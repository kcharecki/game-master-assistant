<script lang="ts">
  import { onMount } from 'svelte';
  import { notebook } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Capture from './Capture.svelte';
  import NoteView from './NoteView.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  onMount(() => void notebook.load());

  const collapsed = $state<Record<number, boolean>>({});

  function sessionLabel(startAt: number, index: number): string {
    const d = new Date(startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${t('notebook.session')} ${index} — ${d}`;
  }
</script>

<div class="nb">
  <Capture />

  <div class="filters">
    <input class="in search" placeholder={t('notebook.search')} bind:value={notebook.query} />
    <button class="btn" onclick={() => notebook.makeRecap()}>{t('notebook.recap')}</button>
    {#if notebook.tags.length}
      <div class="tags">
        {#each notebook.tags as tag (tag)}
          <button
            class="chip"
            class:on={notebook.activeTag === tag}
            onclick={() => notebook.setTag(tag)}>#{tag}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  {#if notebook.recap}
    <div class="recap">
      <button class="rclose" title={t('notebook.dismiss')} aria-label={t('notebook.dismissRecap')} onclick={() => (notebook.recap = null)}>×</button>
      <pre>{notebook.recap}</pre>
    </div>
  {/if}

  <div class="list">
    {#each notebook.sessions as group (group.index)}
      <div class="sess">
        <button class="shead" onclick={() => (collapsed[group.index] = !collapsed[group.index])}>
          <span class="caret">{collapsed[group.index] ? '▸' : '▾'}</span>
          {sessionLabel(group.startAt, group.index)}
          <span class="count">{group.notes.length}</span>
        </button>
        {#if !collapsed[group.index]}
          <ul class="notes">
            {#each group.notes as n (n.id)}
              <NoteView note={n} />
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <Empty text={t('notebook.noNotes')} icon="edit" />
    {/each}
  </div>

  {#if notebook.lastArchivedId}
    <div class="toast">
      <span>{t('notebook.deleted')}</span>
      <button class="undo" onclick={() => notebook.undo()}>{t('notebook.undo')}</button>
    </div>
  {/if}
</div>

<style>
  .nb {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  .filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
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
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
  }
  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .chip.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .recap {
    position: relative;
    border: 1px solid var(--green-dim);
    border-radius: 8px;
    background: rgba(47, 138, 102, 0.1);
    padding: 8px 26px 8px 10px;
  }
  .recap pre {
    margin: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .rclose {
    position: absolute;
    top: 4px;
    right: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
  }
  .shead {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 4px;
    border: none;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .shead:hover {
    color: var(--txt);
  }
  .caret {
    width: 10px;
  }
  .count {
    margin-left: auto;
    color: var(--muted);
    font-size: 11px;
  }
  .notes {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* Telegram / newspaper-clipping slip: aged paper, torn edges, monospace. */
  .toast {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    border-radius: 2px;
    background: #efe7d2;
    color: #211d15;
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
    box-shadow:
      0 8px 22px -8px rgba(0, 0, 0, 0.7),
      inset 0 0 0 1px rgba(120, 100, 60, 0.35);
    -webkit-mask:
      radial-gradient(5px 5px at 5px 0, transparent 96%, #000) 0 0 / 12px 100%,
      radial-gradient(5px 5px at 5px 100%, transparent 96%, #000) 0 100% / 12px 100%,
      linear-gradient(#000, #000);
    mask:
      radial-gradient(5px 5px at 5px 0, transparent 96%, #000) 0 0 / 12px 100%,
      radial-gradient(5px 5px at 5px 100%, transparent 96%, #000) 0 100% / 12px 100%,
      linear-gradient(#000, #000);
    -webkit-mask-repeat: repeat-x, repeat-x, no-repeat;
    mask-repeat: repeat-x, repeat-x, no-repeat;
    -webkit-mask-composite: source-out;
    mask-composite: subtract;
  }
  .undo {
    border: none;
    background: transparent;
    color: #7a2f12;
    font: inherit;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
  }
  .undo:hover {
    color: #a83c12;
    text-decoration: underline;
  }
</style>
