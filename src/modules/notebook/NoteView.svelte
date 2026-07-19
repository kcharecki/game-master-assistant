<script lang="ts">
  import { notebook, type Note } from './store.svelte';
  import { renderMarkdown, highlight, relativeShort } from './logic';
  import { assetPut, assetUrl } from '../../lib/db';
  import { t } from '../../lib/i18n';
  import { openRef } from '../../lib/xref';
  import Icon from '../../lib/components/Icon.svelte';

  let { note, focused = false }: { note: Note; focused?: boolean } = $props();

  let editing = $state(false);
  let draft = $state('');
  let imgUrl = $state<string | undefined>(undefined);
  let copied = $state(false);

  // Resolve the attached image blob to an object URL; revoke on change/unmount.
  $effect(() => {
    const id = note.assetId;
    if (!id) {
      imgUrl = undefined;
      return;
    }
    let url: string | undefined;
    let cancelled = false;
    void assetUrl(id).then((u) => {
      if (!u) return;
      if (cancelled) {
        URL.revokeObjectURL(u);
        return;
      }
      url = u;
      imgUrl = u;
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  // The focused note always renders as markdown (the reading view). In the
  // stream/list, a search highlights raw matches; otherwise render markdown.
  const html = $derived(
    !focused && notebook.query.trim()
      ? highlight(note.body, notebook.query)
      : renderMarkdown(note.body, { wikilink: true })
  );

  // One 9px-mono context stamp: round · on-air · in-world date · age.
  const stamp = $derived.by(() => {
    const p: string[] = [];
    if (note.ctx?.round) p.push(`R${note.ctx.round}`);
    if (note.ctx?.onAir) p.push(`${t('notebook.onAir')}: ${note.ctx.onAir}`.toUpperCase());
    if (note.ctx?.ivDate) p.push(note.ctx.ivDate.toUpperCase());
    p.push(relativeShort(note.at));
    return p.join(' · ');
  });

  function startEdit() {
    draft = note.body;
    editing = true;
  }
  function saveEdit() {
    notebook.update(note.id, draft);
    editing = false;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(note.body);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  async function attach(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const id = await assetPut(file, file.type);
    notebook.attach(note.id, id);
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
      openRef(wiki.dataset.wiki ?? '');
    }
  }
</script>

<li class="nb-note" class:pinned={note.pinned} class:focused>
  <div class="nb-chrome">
    <span class="nb-stamp">{stamp}</span>
    <div class="nb-acts">
      <button
        class="nb-ic"
        class:on={note.pinned}
        title={note.pinned ? t('notebook.unpin') : t('notebook.pin')}
        aria-label={note.pinned ? t('notebook.unpin') : t('notebook.pin')}
        onclick={() => notebook.togglePin(note.id)}><Icon name="pin" size={14} /></button
      >
      <label class="nb-ic" title={t('notebook.attach')}>
        <Icon name="attach" size={14} />
        <input type="file" accept="image/*" hidden onchange={(e) => attach((e.currentTarget as HTMLInputElement).files?.[0])} />
      </label>
      <button class="nb-ic" class:on={copied} title={t('notebook.copy')} aria-label={t('notebook.copy')} onclick={copy}><Icon name="duplicate" size={14} /></button>
      <button class="nb-ic" title={t('notebook.edit')} aria-label={t('notebook.editNote')} onclick={startEdit}><Icon name="edit" size={14} /></button>
      <button class="nb-ic danger" title={t('notebook.archive')} aria-label={t('notebook.deleteNote')} onclick={() => notebook.remove(note.id)}><Icon name="trash" size={14} /></button>
    </div>
  </div>

  {#if editing}
    <textarea class="nb-edit" bind:value={draft} rows="4"></textarea>
    <div class="nb-editacts">
      <button class="nb-ebtn" onclick={saveEdit}>{t('notebook.save')}</button>
      <button class="nb-ebtn ghost" onclick={() => (editing = false)}>{t('notebook.cancel')}</button>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown/highlight escape all input; only our own tags are re-added -->
    <div class="nb-body" onclick={onBodyClick}>{@html html}</div>
    {#if imgUrl}
      <img class="nb-att" src={imgUrl} alt="" />
    {/if}
  {/if}
</li>

<style>
  .nb-note {
    position: relative;
    list-style: none;
    border: 1px solid transparent;
    border-radius: var(--r2);
    padding: 7px 9px;
    background: var(--fill-g08);
  }
  .nb-note:hover {
    border-color: var(--line1);
  }
  .nb-note.pinned {
    border-color: var(--green-dim);
    background: var(--fill-g08);
  }
  .nb-note.focused {
    border-color: var(--line1);
    background: transparent;
    padding: 0;
  }
  .nb-chrome {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .nb-stamp {
    flex: 1;
    min-width: 0;
    color: var(--faint);
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nb-acts {
    display: flex;
    gap: 1px;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .nb-note:hover .nb-acts,
  .nb-note.focused .nb-acts {
    opacity: 1;
  }
  .nb-ic {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: var(--r1);
  }
  .nb-ic:hover {
    color: var(--gold);
    border-color: var(--gold);
    background: var(--fill-gold);
  }
  .nb-ic.on {
    color: var(--gold);
    border-color: var(--gold);
  }
  .nb-ic.danger:hover {
    color: var(--red);
    border-color: var(--red-dim);
    background: var(--fill-red);
  }
  /* focused note: boxed action chrome, always visible (design B) */
  .nb-note.focused .nb-ic {
    border-color: var(--line2);
    padding: 5px 7px;
    font-size: 13px;
  }
  .nb-body {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--txt);
    word-break: break-word;
  }
  .nb-note.focused .nb-body {
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.6;
    margin-top: 6px;
  }
  .nb-body :global(p) {
    margin: 0 0 5px;
  }
  .nb-body :global(.md-h) {
    font-family: var(--serif);
    font-size: 1.15em;
    font-weight: 600;
    color: var(--txt);
    margin: 0 0 6px;
  }
  .nb-note.focused .nb-body :global(.md-h) {
    color: #eef3ee;
    font-size: 1.5em;
  }
  .nb-body :global(.md-list) {
    margin: 2px 0;
    padding-left: 18px;
  }
  .nb-body :global(.md-todo) {
    list-style: none;
    margin-left: -18px;
  }
  .nb-body :global(.md-todo input) {
    cursor: pointer;
    accent-color: var(--gold);
  }
  .nb-body :global(.md-done) {
    color: var(--muted);
    text-decoration: line-through;
  }
  .nb-body :global(.md-tag),
  .nb-body :global(.md-npc) {
    color: var(--gold);
  }
  .nb-body :global(.md-wiki) {
    color: var(--gold);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .nb-body :global(code) {
    background: var(--bg1);
    padding: 0 3px;
    border-radius: var(--r1);
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .nb-body :global(mark) {
    background: var(--fill-gold);
    color: var(--gold);
    border-radius: var(--r1);
    padding: 0 1px;
  }
  .nb-att {
    display: block;
    margin-top: 6px;
    max-width: 100%;
    max-height: 200px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
  }
  .nb-edit {
    box-sizing: border-box;
    width: 100%;
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    resize: vertical;
  }
  .nb-editacts {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .nb-ebtn {
    padding: 4px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--green-dim);
    background: var(--surface2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .nb-ebtn.ghost {
    color: var(--muted);
    border-color: var(--line2);
  }
</style>
