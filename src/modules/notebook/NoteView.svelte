<script lang="ts">
  import { notebook, type Note } from './store.svelte';
  import { renderMarkdown, highlight } from './logic';
  import { assetUrl } from '../../lib/db';
  import { t } from '../../lib/i18n';

  let { note }: { note: Note } = $props();

  let editing = $state(false);
  let draft = $state('');
  let imgUrl = $state<string | undefined>(undefined);

  // Resolve the attached image blob to an object URL; revoke on change/unmount.
  $effect(() => {
    const id = note.assetId;
    if (!id) {
      imgUrl = undefined;
      return;
    }
    let url: string | undefined;
    void assetUrl(id).then((u) => {
      url = u;
      imgUrl = u;
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  // Rendered HTML — highlight search matches when searching, else markdown.
  const html = $derived(
    notebook.query.trim()
      ? highlight(note.body, notebook.query)
      : renderMarkdown(note.body, { wikilink: true })
  );

  function startEdit() {
    draft = note.body;
    editing = true;
  }
  function saveEdit() {
    notebook.update(note.id, draft);
    editing = false;
  }

  function onBodyClick(e: MouseEvent) {
    const el = e.target as HTMLElement;
    const todo = el.closest('input[data-todo]') as HTMLInputElement | null;
    if (todo) {
      e.preventDefault();
      notebook.toggleTodo(note.id, Number(todo.dataset.todo));
      return;
    }
    const wiki = el.closest('a[data-wiki]') as HTMLAnchorElement | null;
    if (wiki) {
      e.preventDefault();
      // Cross-module jump is another group's job — dispatch a global event stub.
      window.dispatchEvent(
        new CustomEvent('notebook:wikilink', { detail: { name: wiki.dataset.wiki } })
      );
    }
  }

  function fmt(at: number): string {
    return new Date(at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<li class="note" class:pinned={note.pinned}>
  <div class="meta">
    <span class="time">{fmt(note.at)}</span>
    <div class="ctx">
      {#if note.ctx?.round}<span class="tag">{t('notebook.round')} {note.ctx.round}</span>{/if}
      {#if note.ctx?.ivDate}<span class="tag">{note.ctx.ivDate}</span>{/if}
      {#if note.ctx?.onAir}<span class="tag">{t('notebook.onAir')}: {note.ctx.onAir}</span>{/if}
    </div>
    <div class="acts">
      <button
        class="ic"
        class:on={note.pinned}
        title={note.pinned ? t('notebook.unpin') : t('notebook.pin')}
        aria-label={note.pinned ? t('notebook.unpin') : t('notebook.pin')}
        onclick={() => notebook.togglePin(note.id)}>{note.pinned ? '★' : '☆'}</button
      >
      <button class="ic" title={t('notebook.edit')} aria-label={t('notebook.editNote')} onclick={startEdit}>✎</button>
      <button class="ic" title={t('notebook.delete')} aria-label={t('notebook.deleteNote')} onclick={() => notebook.remove(note.id)}>×</button>
    </div>
  </div>

  {#if editing}
    <textarea class="edit" bind:value={draft} rows="4"></textarea>
    <div class="editacts">
      <button class="btn sm" onclick={saveEdit}>{t('notebook.save')}</button>
      <button class="btn sm ghost" onclick={() => (editing = false)}>{t('notebook.cancel')}</button>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown/highlight escape all input; only our own tags are re-added -->
    <div class="body" onclick={onBodyClick}>{@html html}</div>
    {#if imgUrl}
      <img class="att" src={imgUrl} alt="" />
    {/if}
  {/if}
</li>

<style>
  .note {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.18);
  }
  .note.pinned {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.08);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .time {
    color: var(--muted);
    font-size: 11px;
  }
  .ctx {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }
  .ctx .tag {
    font-size: 10px;
    color: var(--muted);
    border: 1px solid var(--line2);
    border-radius: 999px;
    padding: 0 6px;
    white-space: nowrap;
  }
  .acts {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }
  .ic {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px 4px;
  }
  .ic:hover {
    color: var(--txt);
  }
  .ic.on {
    color: var(--green);
  }
  .body {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--txt);
    word-break: break-word;
  }
  .body :global(p) {
    margin: 0 0 4px;
  }
  .body :global(.md-list) {
    margin: 2px 0;
    padding-left: 18px;
  }
  .body :global(.md-todo) {
    list-style: none;
    margin-left: -18px;
  }
  .body :global(.md-done) {
    color: var(--muted);
    text-decoration: line-through;
  }
  .body :global(.md-tag) {
    color: var(--green);
  }
  .body :global(.md-wiki) {
    color: var(--green);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .body :global(code) {
    background: rgba(0, 0, 0, 0.3);
    padding: 0 3px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .body :global(mark) {
    background: var(--green-dim);
    color: #041210;
    border-radius: 2px;
  }
  .att {
    display: block;
    margin-top: 6px;
    max-width: 100%;
    max-height: 180px;
    border-radius: 6px;
    border: 1px solid var(--line2);
  }
  .edit {
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    resize: vertical;
  }
  .editacts {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .btn.sm {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .btn.sm.ghost {
    color: var(--muted);
    border-color: var(--line2);
  }
</style>
