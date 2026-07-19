<script lang="ts">
  import { onMount } from 'svelte';
  import { lore } from './store.svelte';
  import { PAGE_KINDS, type PageKind } from './logic';
  import { renderMarkdown } from '../notebook/logic';
  import { assetUrl } from '../../lib/db';
  import { t } from '../../lib/i18n';
  import { loc } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import type { Locale } from '../../lib/stores/lang.svelte';
  import { toast } from '../../lib/stores/toast.svelte';
  import { putOnAir } from '../reveal/bus-actions';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';
  import GraphView from './GraphView.svelte';

  onMount(() => void lore.load());

  // ── Graph + import/export ────────────────────────────────────────────
  let showGraph = $state(false);
  let showImport = $state(false);
  let importText = $state('');
  let importMode = $state<'merge' | 'replace'>('merge');

  function exportFile() {
    const url = URL.createObjectURL(new Blob([lore.exportJSON()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lore-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show(t('lore.exportDone'));
  }

  function runImport() {
    const text = importText.trim();
    if (!text) return;
    // 'replace' wipes the whole wiki — guard against an accidental click.
    if (importMode === 'replace' && lore.pages.length && !confirm(t('lore.replaceConfirm'))) return;
    const res = lore.importJSON(text, importMode);
    if (res.error) {
      toast.show(t('lore.importError'));
      return;
    }
    toast.show(`${t('lore.importDone')} (${res.imported})`);
    importText = '';
    showImport = false;
    showGraph = false;
  }

  async function importFromFile(file: File | undefined) {
    if (!file) return;
    importText = await file.text();
  }

  const LOCALES: Locale[] = ['en', 'pl'];
  // Which language the authoring forms edit; the other language is preserved.
  let editLang = $state<Locale>(lang.current);

  // ── Navigator state ──────────────────────────────────────────────────
  let query = $state('');
  let kindFilter = $state<PageKind | 'all'>('all');
  let tagFilter = $state<string>('');

  const kindLabel = (k: PageKind) => t(`lore.kind.${k}`);
  // Short kind badge glyph for list rows (no emoji — matches the icon house style).
  const kindGlyph = (k: PageKind) => kindLabel(k).slice(0, 2).toUpperCase();

  const results = $derived(
    lore.search(query, {
      kind: kindFilter === 'all' ? undefined : kindFilter,
      tag: tagFilter || undefined,
    }),
  );

  // All distinct tags across pages, sorted — drives the tag filter row.
  const allTags = $derived.by(() => {
    const set = new Set<string>();
    for (const p of lore.pages) for (const tg of p.tags) set.add(tg);
    return [...set].sort();
  });

  const sel = $derived(lore.selected);
  const links = $derived(sel ? lore.linksOf(sel.id) : []);
  const backs = $derived(sel ? lore.backlinksOf(sel.id) : []);
  const mentions = $derived(sel ? lore.mentionsOf(sel.id) : []);

  function newPage() {
    lore.add(kindFilter === 'all' ? 'concept' : kindFilter);
  }

  // ── Content pane ─────────────────────────────────────────────────────
  let showPreview = $state(false);
  const previewHtml = $derived(
    sel ? renderMarkdown(loc(sel.body, editLang), { wikilink: true }) : '',
  );

  function openOrCreate(target: string, targetId: string | undefined) {
    if (targetId) lore.select(targetId);
    else lore.select(lore.add('concept', target).id);
  }

  function onPreviewClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[data-wiki]') as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const target = a.dataset.wiki ?? '';
    const link = links.find((l) => l.target.toLowerCase() === target.toLowerCase());
    openOrCreate(target, link?.targetId);
  }

  // ── Meta pane ────────────────────────────────────────────────────────
  let tagInput = $state('');
  let aliasInput = $state('');

  function addTag() {
    const v = tagInput.trim().toLowerCase();
    tagInput = '';
    if (!sel || !v || sel.tags.includes(v)) return;
    lore.update(sel.id, { tags: [...sel.tags, v] });
  }
  function removeTag(tag: string) {
    if (!sel) return;
    lore.update(sel.id, { tags: sel.tags.filter((x) => x !== tag) });
  }
  function addAlias() {
    const v = aliasInput.trim();
    aliasInput = '';
    if (!sel || !v || sel.aliases.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    lore.update(sel.id, { aliases: [...sel.aliases, v] });
  }
  function removeAlias(alias: string) {
    if (!sel) return;
    lore.update(sel.id, { aliases: sel.aliases.filter((a) => a !== alias) });
  }

  async function pickImage(file: File | undefined) {
    if (!sel || !file || !file.type.startsWith('image/')) return;
    await lore.setImage(sel.id, file);
  }
  function removeImage() {
    if (sel) lore.update(sel.id, { imageId: undefined });
  }

  // Resolve the current page's image asset id → an object URL; revoke on change.
  let imgUrl = $state<string | undefined>(undefined);
  $effect(() => {
    const id = sel?.imageId;
    if (!id) {
      imgUrl = undefined;
      return;
    }
    let url: string | undefined;
    let live = true;
    void assetUrl(id).then((u) => {
      if (!live) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      url = u ?? undefined;
      imgUrl = url;
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  });

  function reveal(which: 'body' | 'image' = 'body') {
    if (!sel || !sel.playerSafe) return;
    const payload = lore.revealPayload(sel.id, lang.current, which);
    if (!payload) return;
    putOnAir(payload);
    toast.show(t('lore.revealed'));
  }
</script>

<div class="lre">
  <!-- ── Left · navigator ─────────────────────────────────────────── -->
  <aside class="lre-nav">
    <div class="lre-tools">
      <button
        class="lre-tool"
        class:on={showGraph}
        title={showGraph ? t('lore.backToPage') : t('lore.graph')}
        onclick={() => (showGraph = !showGraph)}
      >
        <Icon name={showGraph ? 'edit' : 'fork'} size={13} />
        {showGraph ? t('lore.backToPage') : t('lore.graph')}
      </button>
      <button class="lre-tool" title={t('lore.export')} onclick={exportFile}>
        <Icon name="export" size={13} /> {t('lore.export')}
      </button>
      <button
        class="lre-tool"
        class:on={showImport}
        title={t('lore.import')}
        onclick={() => (showImport = !showImport)}
      >
        <Icon name="attach" size={13} /> {t('lore.import')}
      </button>
    </div>

    {#if showImport}
      <div class="lre-import">
        <textarea
          class="lre-in lre-importbox"
          placeholder={t('lore.importPlaceholder')}
          bind:value={importText}
        ></textarea>
        <label class="lre-importfile">
          <Icon name="attach" size={12} /> {t('lore.importFile')}
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onchange={(e) => void importFromFile(e.currentTarget.files?.[0])}
          />
        </label>
        <div class="lre-chips">
          <button class="lre-fchip" class:on={importMode === 'merge'} onclick={() => (importMode = 'merge')}
            >{t('lore.merge')}</button
          >
          <button class="lre-fchip" class:on={importMode === 'replace'} onclick={() => (importMode = 'replace')}
            >{t('lore.replace')}</button
          >
        </div>
        <button class="lre-btn solid sm" disabled={!importText.trim()} onclick={runImport}
          >{t('lore.import')}</button
        >
      </div>
    {/if}

    <div class="lre-searchrow">
      <Icon name="search" size={14} />
      <input class="lre-in lre-search" placeholder={t('lore.searchPlaceholder')} bind:value={query} />
    </div>

    <div class="lre-chips">
      <button class="lre-fchip" class:on={kindFilter === 'all'} onclick={() => (kindFilter = 'all')}
        >{t('lore.filterAll')}</button
      >
      {#each PAGE_KINDS as k (k)}
        <button class="lre-fchip" class:on={kindFilter === k} onclick={() => (kindFilter = k)}
          >{kindLabel(k)}</button
        >
      {/each}
    </div>

    {#if allTags.length}
      <div class="lre-chips lre-tagfilter">
        {#each allTags as tg (tg)}
          <button
            class="lre-fchip tag"
            class:on={tagFilter === tg}
            onclick={() => (tagFilter = tagFilter === tg ? '' : tg)}>#{tg}</button
          >
        {/each}
      </div>
    {/if}

    <button class="lre-btn solid" onclick={newPage}><Icon name="plus" size={14} /> {t('lore.newPage')}</button>

    {#if lore.pages.length === 0}
      <Empty text={t('lore.empty')} actionLabel={t('lore.newPage')} onAction={newPage} />
    {:else}
      <ul class="lre-list">
        {#each results as p (p.id)}
          <li class="lre-row" class:on={p.id === lore.selectedId}>
            <button class="lre-rowbtn" onclick={() => lore.select(p.id)}>
              <span class="lre-glyph" title={kindLabel(p.kind)}>{kindGlyph(p.kind)}</span>
              <span class="lre-rowtitle">{loc(p.title, lang.current) || t('lore.untitled')}</span>
            </button>
            <button
              class="lre-pin"
              class:on={p.pinned}
              title={p.pinned ? t('lore.unpin') : t('lore.pin')}
              aria-label={p.pinned ? t('lore.unpin') : t('lore.pin')}
              onclick={() => lore.togglePin(p.id)}><Icon name="pin" size={13} /></button
            >
          </li>
        {:else}
          <li class="lre-muted">{t('lore.noResults')}</li>
        {/each}
      </ul>
    {/if}
  </aside>

  <!-- ── Center · content ─────────────────────────────────────────── -->
  <section class="lre-content" class:graph={showGraph}>
    {#if showGraph}
      <GraphView onpick={() => (showGraph = false)} />
    {:else if sel}
      <div class="lre-langrow">
        <div class="lre-langs" title={t('lore.editLang')}>
          {#each LOCALES as l (l)}
            <button class="lre-lang" class:on={editLang === l} onclick={() => (editLang = l)}
              >{l.toUpperCase()}</button
            >
          {/each}
        </div>
      </div>

      <input
        class="lre-in lre-title"
        value={loc(sel.title, editLang)}
        onchange={(e) => lore.setField(sel.id, 'title', editLang, e.currentTarget.value)}
        placeholder={t('lore.titlePlaceholder')}
      />

      <span class="lre-lbl">{t('lore.summary')}</span>
      <input
        class="lre-in"
        value={loc(sel.summary, editLang)}
        onchange={(e) => lore.setField(sel.id, 'summary', editLang, e.currentTarget.value)}
        placeholder={t('lore.summaryPlaceholder')}
      />

      <div class="lre-lblrow">
        <span class="lre-lbl">{t('lore.body')}</span>
        <button class="lre-toggle" onclick={() => (showPreview = !showPreview)}
          >{showPreview ? t('lore.write') : t('lore.preview')}</button
        >
      </div>
      {#if showPreview}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input; only our own tags are re-added -->
        <div class="lre-in lre-preview" onclick={onPreviewClick}>{@html previewHtml}</div>
      {:else}
        <textarea
          class="lre-in lre-body"
          value={loc(sel.body, editLang)}
          oninput={(e) => lore.setField(sel.id, 'body', editLang, e.currentTarget.value)}
          placeholder={t('lore.bodyPlaceholder')}
        ></textarea>
      {/if}

      <span class="lre-lbl secret">{t('lore.secret')}</span>
      <textarea
        class="lre-in lre-secret"
        value={loc(sel.secret, editLang)}
        oninput={(e) => lore.setField(sel.id, 'secret', editLang, e.currentTarget.value)}
        placeholder={t('lore.secretPlaceholder')}
      ></textarea>
    {:else}
      <p class="lre-hint">{t('lore.noPageSelected')}</p>
    {/if}
  </section>

  <!-- ── Right · metadata & connections ──────────────────────────── -->
  <aside class="lre-meta">
    {#if sel}
      <span class="lre-lbl">{t('lore.kindLabel')}</span>
      <div class="lre-chips">
        {#each PAGE_KINDS as k (k)}
          <button
            class="lre-fchip"
            class:on={sel.kind === k}
            onclick={() => lore.update(sel.id, { kind: k })}>{kindLabel(k)}</button
          >
        {/each}
      </div>

      <span class="lre-lbl">{t('lore.tags')}</span>
      <div class="lre-editchips">
        {#each sel.tags as tg (tg)}
          <span class="lre-echip"
            >#{tg}<button class="lre-echipx" aria-label={t('lore.removeTag')} onclick={() => removeTag(tg)}
              ><Icon name="close" size={11} /></button
            ></span
          >
        {/each}
      </div>
      <input
        class="lre-in sm"
        placeholder={t('lore.tagPlaceholder')}
        bind:value={tagInput}
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
        onblur={addTag}
      />

      <span class="lre-lbl">{t('lore.aliases')}</span>
      <div class="lre-editchips">
        {#each sel.aliases as a (a)}
          <span class="lre-echip"
            >{a}<button class="lre-echipx" aria-label={t('lore.removeAlias')} onclick={() => removeAlias(a)}
              ><Icon name="close" size={11} /></button
            ></span
          >
        {/each}
      </div>
      <input
        class="lre-in sm"
        placeholder={t('lore.aliasPlaceholder')}
        bind:value={aliasInput}
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
        onblur={addAlias}
      />
      <p class="lre-note">{t('lore.aliasHint')}</p>

      <span class="lre-lbl">{t('lore.image')}</span>
      <div class="lre-imgbox">
        {#if imgUrl}
          <img class="lre-img" src={imgUrl} alt="" />
          <button class="lre-btn danger sm" onclick={removeImage}>{t('lore.removeImage')}</button>
        {:else}
          <label class="lre-upload" title={t('lore.uploadImage')}>
            <Icon name="plus" size={16} /> {t('lore.uploadImage')}
            <input
              type="file"
              accept="image/*"
              hidden
              onchange={(e) => void pickImage(e.currentTarget.files?.[0])}
            />
          </label>
        {/if}
      </div>

      <div class="lre-safe">
        <label class="lre-check">
          <input
            type="checkbox"
            checked={sel.playerSafe}
            onchange={(e) => lore.update(sel.id, { playerSafe: e.currentTarget.checked })}
          />
          <span class="lre-lbl green inline">{t('lore.playerSafe')}</span>
        </label>
        <p class="lre-note">{t('lore.playerSafeHint')}</p>
        <button class="lre-btn air" disabled={!sel.playerSafe} onclick={() => reveal('body')}>{t('lore.reveal')}</button>
        {#if sel.playerSafe && sel.imageId}
          <button class="lre-btn air sm" onclick={() => reveal('image')}>{t('lore.revealImage')}</button>
        {/if}
        {#if !sel.playerSafe}
          <p class="lre-note">{t('lore.revealDisabledHint')}</p>
        {/if}
      </div>

      <span class="lre-lbl">{t('lore.linksOut')}</span>
      {#if links.length}
        <div class="lre-connect">
          {#each links as l (l.target)}
            <button
              class="lre-chip"
              class:dangling={!l.targetId}
              onclick={() => openOrCreate(l.target, l.targetId)}
              >{l.label}{#if !l.targetId}<span class="lre-plus"><Icon name="plus" size={12} /></span>{/if}</button
            >
          {/each}
        </div>
      {:else}
        <span class="lre-muted">{t('lore.none')}</span>
      {/if}

      <span class="lre-lbl">{t('lore.backlinksHead')}</span>
      {#if backs.length}
        <div class="lre-connect">
          {#each backs as b (b.id)}
            <button class="lre-chip" onclick={() => lore.select(b.id)}
              >{loc(b.title, lang.current) || t('lore.untitled')}</button
            >
          {/each}
        </div>
      {:else}
        <span class="lre-muted">{t('lore.none')}</span>
      {/if}

      <span class="lre-lbl">{t('lore.mentions')}</span>
      {#if mentions.length}
        <div class="lre-connect">
          {#each mentions as m (m.id)}
            <button class="lre-chip ghost" onclick={() => lore.select(m.id)}
              >{loc(m.title, lang.current) || t('lore.untitled')}</button
            >
          {/each}
        </div>
        <p class="lre-note">{t('lore.mentionsHint')}</p>
      {:else}
        <span class="lre-muted">{t('lore.none')}</span>
      {/if}

      <button class="lre-btn danger del" onclick={() => lore.remove(sel.id)}
        ><Icon name="trash" size={14} /> {t('lore.deletePage')}</button
      >
    {/if}
  </aside>
</div>

<style>
  .lre {
    display: grid;
    grid-template-columns: minmax(190px, 22%) 1fr minmax(220px, 26%);
    height: 100%;
    overflow: hidden;
    background: var(--bg1);
  }

  /* ── Navigator ─────────────────────────────────────────────── */
  .lre-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-right: 1px solid var(--line1);
    min-height: 0;
    overflow: hidden;
  }
  .lre-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line1);
  }
  .lre-tool {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .lre-tool:hover {
    border-color: var(--green);
    color: var(--green);
  }
  .lre-tool.on {
    border-color: var(--green);
    color: var(--green);
    background: var(--fill-g08);
  }
  .lre-import {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line1);
    background: var(--surface2);
  }
  .lre-importbox {
    min-height: 90px;
    resize: vertical;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 11.5px;
    line-height: 1.4;
  }
  .lre-importfile {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    padding: 6px 8px;
    border-radius: var(--r2);
    border: 1px dashed var(--line2);
    background: var(--bg1);
    color: var(--green);
    cursor: pointer;
    font-size: 11px;
  }
  .lre-importfile:hover {
    background: var(--fill-g08);
  }

  .lre-searchrow {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
  }
  .lre-search {
    border: 0 !important;
    padding-left: 0 !important;
    background: transparent !important;
  }
  .lre-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .lre-tagfilter {
    padding-bottom: 2px;
    border-bottom: 1px solid var(--line1);
  }
  .lre-fchip {
    padding: 3px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .lre-fchip:hover {
    border-color: var(--line2);
  }
  .lre-fchip.on {
    border-color: var(--green);
    color: var(--green);
  }
  .lre-fchip.tag.on {
    color: var(--green);
  }
  .lre-list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .lre-row {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: var(--r2);
    border: 1px solid transparent;
  }
  .lre-row.on {
    border-color: var(--green);
    background: var(--surface2);
  }
  .lre-row:hover:not(.on) {
    background: var(--fill-g08);
  }
  .lre-rowbtn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border: 0;
    background: none;
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .lre-glyph {
    flex: 0 0 auto;
    width: 24px;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--muted);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    padding: 2px 0;
  }
  .lre-rowtitle {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lre-pin {
    flex: 0 0 auto;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    opacity: 0.5;
  }
  .lre-pin:hover {
    opacity: 1;
  }
  .lre-pin.on {
    color: var(--green);
    opacity: 1;
  }

  /* ── Content ───────────────────────────────────────────────── */
  .lre-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 18px;
    min-height: 0;
    overflow: auto;
  }
  .lre-content.graph {
    padding: 0;
    overflow: hidden;
  }
  .lre-langrow {
    display: flex;
    justify-content: flex-end;
  }
  .lre-langs {
    display: flex;
    gap: 2px;
  }
  .lre-lang {
    padding: 4px 10px;
    border-radius: var(--r1);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  .lre-lang.on {
    border-color: var(--green);
    color: var(--green);
  }

  /* ── Meta ──────────────────────────────────────────────────── */
  .lre-meta {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 14px 14px;
    border-left: 1px solid var(--line1);
    min-height: 0;
    overflow: auto;
  }

  /* ── Shared controls ───────────────────────────────────────── */
  .lre-in {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 9px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .lre-in.sm {
    padding: 5px 8px;
    font-size: 12px;
  }
  .lre-title {
    font-family: var(--serif), Georgia, serif;
    font-size: 18px;
    font-weight: 600;
  }
  .lre-body {
    min-height: 220px;
    flex: 1;
    resize: vertical;
    line-height: 1.55;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 12.5px;
  }
  .lre-secret {
    min-height: 70px;
    resize: vertical;
    line-height: 1.5;
    border-color: var(--red-dim);
    background: rgba(122, 42, 42, 0.08);
  }
  .lre-preview {
    min-height: 220px;
    flex: 1;
    overflow: auto;
    line-height: 1.55;
    font-size: 13px;
  }
  .lre-preview :global(.md-h) {
    font-family: var(--serif), Georgia, serif;
    font-size: 15px;
    margin: 6px 0 2px;
    color: var(--txt);
  }
  .lre-preview :global(p) {
    margin: 4px 0;
  }
  .lre-preview :global(.md-list) {
    margin: 4px 0;
    padding-left: 18px;
  }
  .lre-preview :global(.md-tag),
  .lre-preview :global(.md-npc) {
    color: var(--gold);
  }
  .lre-preview :global(.md-wiki) {
    color: var(--gold);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .lre-preview :global(code) {
    background: var(--surface2);
    padding: 0 3px;
    border-radius: var(--r1);
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }

  .lre-lbl {
    display: block;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 6px;
  }
  .lre-lbl.secret {
    color: var(--red);
  }
  .lre-lbl.green {
    color: var(--green);
  }
  .lre-lbl.inline {
    margin-top: 0;
  }
  .lre-lblrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
  }
  .lre-lblrow .lre-lbl {
    margin-top: 0;
  }
  .lre-toggle {
    padding: 3px 10px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .lre-toggle:hover {
    border-color: var(--green);
    color: var(--green);
  }

  .lre-editchips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .lre-echip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 4px 2px 8px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    font-size: 12px;
  }
  .lre-echipx {
    display: inline-flex;
    padding: 1px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .lre-echipx:hover {
    color: var(--red);
  }
  .lre-note {
    font-size: 10.5px;
    color: var(--muted);
    font-style: italic;
    line-height: 1.4;
    margin: 2px 0 0;
  }

  .lre-imgbox {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lre-img {
    width: 100%;
    max-height: 160px;
    object-fit: cover;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
  }
  .lre-upload {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    padding: 14px 10px;
    border-radius: var(--r2);
    border: 1px dashed var(--line2);
    background: var(--bg1);
    color: var(--green);
    cursor: pointer;
    font-size: 12px;
  }
  .lre-upload:hover {
    background: var(--fill-g08);
  }

  .lre-safe {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    padding: 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line1);
    background: var(--surface2);
  }
  .lre-check {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .lre-check input {
    accent-color: var(--green);
  }

  .lre-connect {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .lre-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .lre-chip:hover {
    border-color: var(--green);
  }
  .lre-chip.dangling {
    color: var(--muted);
    border-style: dashed;
  }
  .lre-chip.ghost {
    color: var(--muted);
  }
  .lre-plus {
    display: inline-flex;
    color: var(--gold);
  }
  .lre-muted {
    color: var(--muted);
    font-size: 12px;
    font-style: italic;
  }

  /* ── Buttons ───────────────────────────────────────────────── */
  .lre-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .lre-btn:hover {
    background: var(--fill-g08);
  }
  .lre-btn.sm {
    padding: 4px 10px;
    align-self: flex-start;
  }
  .lre-btn.solid {
    border-color: var(--green);
    color: var(--green);
  }
  .lre-btn.air {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--fill-gold);
  }
  .lre-btn.air:hover:not(:disabled) {
    background: linear-gradient(180deg, var(--gold-hi), var(--gold));
    color: var(--gold-ink);
  }
  .lre-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .lre-btn.danger {
    color: var(--red);
  }
  .lre-btn.danger:hover {
    background: var(--fill-red);
    border-color: var(--red-dim);
    color: var(--red);
  }
  .lre-btn.del {
    margin-top: 14px;
  }
  .lre-hint {
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
    margin: auto;
  }
</style>
