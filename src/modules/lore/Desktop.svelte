<script lang="ts">
  import { onMount } from 'svelte';
  import { lore } from './store.svelte';
  import { PAGE_KINDS, type PageKind } from './logic';
  import { renderMarkdown } from '../notebook/logic';
  import { assetUrl } from '../../lib/db';
  import { t } from '../../lib/i18n';
  import { loc } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import { toast } from '../../lib/stores/toast.svelte';
  import { putOnAir } from '../reveal/bus-actions';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  onMount(() => void lore.load());

  // ── Fast lookup state ────────────────────────────────────────────────
  let query = $state('');
  let kindFilter = $state<PageKind | 'all'>('all');

  const kindLabel = (k: PageKind) => t(`lore.kind.${k}`);
  // Short kind badge glyph — matches Editor's icon-house style (no emoji).
  const kindGlyph = (k: PageKind) => kindLabel(k).slice(0, 2).toUpperCase();

  const results = $derived(
    lore.search(query, { kind: kindFilter === 'all' ? undefined : kindFilter }),
  );

  const sel = $derived(lore.selected);
  const links = $derived(sel ? lore.linksOf(sel.id) : []);
  const backs = $derived(sel ? lore.backlinksOf(sel.id) : []);

  // Rendered body of the selected page in the current UI language.
  const bodyHtml = $derived(
    sel ? renderMarkdown(loc(sel.body, lang.current), { wikilink: true }) : '',
  );

  function openOrCreate(target: string, targetId: string | undefined) {
    if (targetId) lore.select(targetId);
    else lore.select(lore.add('concept', target).id);
  }

  // Delegated wikilink click — resolve via the selected page's out-links, then
  // select the target (or create a dangling stub). @npc/#tag spans just render.
  function onBodyClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[data-wiki]') as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const target = a.dataset.wiki ?? '';
    const link = links.find((l) => l.target.toLowerCase() === target.toLowerCase());
    openOrCreate(target, link?.targetId);
  }

  // Resolve the selected page's image asset id → object URL; revoke on change.
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

<div class="lrw">
  <!-- ── Search + kind filter (always full width) ─────────────────── -->
  <div class="lrw-top">
    <div class="lrw-searchrow">
      <Icon name="search" size={14} />
      <input
        class="lrw-search"
        placeholder={t('lore.searchPlaceholder')}
        bind:value={query}
      />
    </div>
    <div class="lrw-chips">
      <button class="lrw-fchip" class:on={kindFilter === 'all'} onclick={() => (kindFilter = 'all')}
        >{t('lore.filterAll')}</button
      >
      {#each PAGE_KINDS as k (k)}
        <button
          class="lrw-fchip"
          class:on={kindFilter === k}
          title={kindLabel(k)}
          onclick={() => (kindFilter = k)}>{kindLabel(k)}</button
        >
      {/each}
    </div>
  </div>

  {#if lore.pages.length === 0}
    <Empty text={t('lore.empty')} />
  {:else}
    <div class="lrw-main">
      <!-- ── Result list ───────────────────────────────────────────── -->
      <ul class="lrw-list">
        {#each results as p (p.id)}
          <li>
            <button
              class="lrw-row"
              class:on={p.id === lore.selectedId}
              onclick={() => lore.select(p.id)}
            >
              <span class="lrw-glyph" title={kindLabel(p.kind)}>{kindGlyph(p.kind)}</span>
              <span class="lrw-rowtitle">{loc(p.title, lang.current) || t('lore.untitled')}</span>
              {#if p.pinned}<span class="lrw-pin" aria-hidden="true"><Icon name="pin" size={11} /></span>{/if}
            </button>
          </li>
        {:else}
          <li class="lrw-muted">{t('lore.noResults')}</li>
        {/each}
      </ul>

      <!-- ── Selected page panel ───────────────────────────────────── -->
      <section class="lrw-panel">
        {#if sel}
          {#if imgUrl}
            <img class="lrw-img" src={imgUrl} alt="" />
          {/if}
          <h2 class="lrw-title">{loc(sel.title, lang.current) || t('lore.untitled')}</h2>

          {#if loc(sel.body, lang.current).trim()}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input; only our own tags are re-added -->
            <div class="lrw-body" onclick={onBodyClick}>{@html bodyHtml}</div>
          {:else}
            <p class="lrw-muted">{t('lore.noContent')}</p>
          {/if}

          {#if backs.length}
            <div class="lrw-backs">
              <span class="lrw-lbl">{t('lore.backlinksHead')}</span>
              <div class="lrw-connect">
                {#each backs as b (b.id)}
                  <button class="lrw-chip" onclick={() => lore.select(b.id)}
                    >{loc(b.title, lang.current) || t('lore.untitled')}</button
                  >
                {/each}
              </div>
            </div>
          {/if}

          <div class="lrw-revealrow">
            <button class="lrw-btn air" disabled={!sel.playerSafe} onclick={() => reveal('body')}
              >{t('lore.reveal')}</button
            >
            {#if sel.playerSafe && sel.imageId}
              <button class="lrw-btn air sm" onclick={() => reveal('image')}
                >{t('lore.revealImage')}</button
              >
            {/if}
            {#if !sel.playerSafe}
              <span class="lrw-hint">{t('lore.revealDisabledHint')}</span>
            {/if}
          </div>
        {:else}
          <p class="lrw-muted center">{t('lore.noPageSelected')}</p>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .lrw {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--bg1);
    /* Enable container queries so the layout responds to the WINDOW size, not
       the viewport (module windows live inside the desktop surface). */
    container-type: inline-size;
  }

  /* ── Search + filter ─────────────────────────────────────────── */
  .lrw-top {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 0 0 auto;
  }
  .lrw-searchrow {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
  }
  .lrw-search {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 7px 0;
    background: transparent;
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .lrw-search:focus {
    outline: none;
  }
  .lrw-chips {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }
  .lrw-fchip {
    flex: 0 0 auto;
    padding: 3px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    white-space: nowrap;
  }
  .lrw-fchip:hover {
    border-color: var(--line2);
  }
  .lrw-fchip.on {
    border-color: var(--green);
    color: var(--green);
  }

  /* ── Main (list + panel) ─────────────────────────────────────── */
  .lrw-main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .lrw-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    /* Narrow/stacked: cap the list so the panel below stays visible. */
    flex: 0 1 auto;
    max-height: 42%;
  }
  .lrw-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: var(--r2);
    border: 1px solid transparent;
    background: none;
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .lrw-row:hover:not(.on) {
    background: var(--fill-g08);
  }
  .lrw-row.on {
    border-color: var(--green);
    background: var(--surface2);
  }
  .lrw-glyph {
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
  .lrw-rowtitle {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lrw-pin {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--green);
  }

  /* ── Selected panel ──────────────────────────────────────────── */
  .lrw-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    border-top: 1px solid var(--line1);
    padding-top: 8px;
  }
  .lrw-img {
    width: 100%;
    max-height: 120px;
    object-fit: cover;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
  }
  .lrw-title {
    margin: 0;
    font-family: var(--serif), Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--txt);
    line-height: 1.2;
  }
  .lrw-body {
    font-size: 13px;
    line-height: 1.55;
    color: var(--txt);
  }
  .lrw-body :global(.md-h) {
    font-family: var(--serif), Georgia, serif;
    font-size: 15px;
    margin: 6px 0 2px;
    color: var(--txt);
  }
  .lrw-body :global(p) {
    margin: 4px 0;
  }
  .lrw-body :global(.md-list) {
    margin: 4px 0;
    padding-left: 18px;
  }
  .lrw-body :global(.md-tag),
  .lrw-body :global(.md-npc) {
    color: var(--gold);
  }
  .lrw-body :global(.md-wiki) {
    color: var(--gold);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .lrw-body :global(code) {
    background: var(--surface2);
    padding: 0 3px;
    border-radius: var(--r1);
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }

  .lrw-backs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid var(--line1);
    padding-top: 6px;
  }
  .lrw-lbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .lrw-connect {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .lrw-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--green);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .lrw-chip:hover {
    border-color: var(--green);
  }

  .lrw-revealrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 6px;
  }
  .lrw-btn {
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
  .lrw-btn.sm {
    padding: 4px 10px;
    font-size: 11px;
  }
  .lrw-btn.air {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--fill-gold);
  }
  .lrw-btn.air:hover:not(:disabled) {
    background: linear-gradient(180deg, var(--gold-hi), var(--gold));
    color: var(--gold-ink);
  }
  .lrw-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .lrw-hint {
    font-size: 10.5px;
    color: var(--muted);
    font-style: italic;
    line-height: 1.35;
    flex: 1;
    min-width: 0;
  }

  .lrw-muted {
    color: var(--muted);
    font-size: 12px;
    font-style: italic;
    padding: 4px 2px;
    list-style: none;
  }
  .lrw-muted.center {
    margin: auto;
  }

  /* ── Wide window → side-by-side list / panel ─────────────────── */
  @container (min-width: 520px) {
    .lrw-main {
      flex-direction: row;
      gap: 12px;
    }
    .lrw-list {
      flex: 0 0 40%;
      max-height: none;
      min-height: 0;
    }
    .lrw-panel {
      border-top: 0;
      border-left: 1px solid var(--line1);
      padding-top: 0;
      padding-left: 12px;
    }
  }
</style>
