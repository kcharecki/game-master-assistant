<script lang="ts">
  import { onMount } from 'svelte';
  import { notebook } from './store.svelte';
  import { openTodos } from './logic';
  import { t } from '../../lib/i18n';
  import Capture from './Capture.svelte';
  import NoteView from './NoteView.svelte';

  onMount(() => void notebook.load());

  const collapsed = $state<Record<number, boolean>>({});
  let renameTo = $state<Record<string, string>>({});

  const todos = $derived(openTodos($state.snapshot(notebook.notes)));

  function sessionLabel(startAt: number, index: number): string {
    const d = new Date(startAt).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${t('notebook.session')} ${index} — ${d}`;
  }

  function doRename(tag: string) {
    const to = (renameTo[tag] ?? '').trim();
    if (!to) return;
    notebook.renameTag(tag, to);
    renameTo[tag] = '';
  }
</script>

<div class="editor">
  <div class="main">
    <header class="ehead">
      <h2>{t('notebook.title')}</h2>
    </header>

    <Capture />

    <div class="filters">
      <input class="in search" placeholder={t('notebook.search')} bind:value={notebook.query} />
      <button class="btn" onclick={() => notebook.makeRecap()}>{t('notebook.recap')}</button>
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
        <p class="muted">{t('notebook.noNotes')}</p>
      {/each}
    </div>
  </div>

  <aside class="side">
    <section>
      <h3>{t('notebook.todos')}</h3>
      {#if todos.length}
        <ul class="todolist">
          {#each todos as td, i (i)}
            <li>{td}</li>
          {/each}
        </ul>
      {:else}
        <p class="muted">{t('notebook.noTodos')}</p>
      {/if}
    </section>

    <section>
      <h3>{t('notebook.tagManage')}</h3>
      {#if notebook.tags.length}
        <ul class="taglist">
          {#each notebook.tags as tag (tag)}
            <li class="tagrow">
              <button
                class="chip"
                class:on={notebook.activeTag === tag}
                onclick={() => notebook.setTag(tag)}>#{tag}</button
              >
              <input
                class="in tiny"
                placeholder={t('notebook.renameTo')}
                value={renameTo[tag] ?? ''}
                oninput={(e) => (renameTo[tag] = (e.currentTarget as HTMLInputElement).value)}
                onkeydown={(e) => e.key === 'Enter' && doRename(tag)}
              />
              <button class="btn sm" onclick={() => doRename(tag)}>{t('notebook.rename')}</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">{t('notebook.noNotes')}</p>
      {/if}
    </section>
  </aside>

  {#if notebook.lastArchivedId}
    <div class="toast">
      <span>{t('notebook.deleted')}</span>
      <button class="undo" onclick={() => notebook.undo()}>{t('notebook.undo')}</button>
    </div>
  {/if}
</div>

<style>
  .editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 20px;
    padding: 22px 26px;
    align-items: start;
    position: relative;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .ehead h2 {
    font-family: Georgia, serif;
    font-size: 22px;
    color: #e9f3ed;
    margin: 0;
  }
  .filters {
    display: flex;
    gap: 8px;
  }
  .in {
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .search {
    flex: 1;
    min-width: 0;
  }
  .tiny {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    font-size: 12px;
  }
  .btn {
    padding: 8px 14px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    cursor: pointer;
  }
  .btn.sm {
    padding: 4px 10px;
    font-size: 12px;
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
    gap: 10px;
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
  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 22px;
  }
  .side h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--green);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .todolist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .todolist li {
    font-size: 12px;
    color: var(--txt);
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.18);
  }
  .taglist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tagrow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chip {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }
  .chip.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
  /* Telegram / newspaper-clipping slip: aged paper, torn edges, monospace. */
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border-radius: 2px;
    background: #efe7d2;
    color: #211d15;
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
    box-shadow:
      0 8px 22px -8px rgba(0, 0, 0, 0.7),
      inset 0 0 0 1px rgba(120, 100, 60, 0.35);
    z-index: 50;
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
