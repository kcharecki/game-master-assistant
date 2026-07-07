<script lang="ts">
  import { notebook } from './store.svelte';
  import { TEMPLATES, escapeHtml } from './logic';
  import { assetPut } from '../../lib/db';
  import { t } from '../../lib/i18n';

  let {
    onsaved,
    variant = 'hero',
    autofocus = false,
  }: { onsaved?: () => void; variant?: 'hero' | 'bar'; autofocus?: boolean } = $props();

  let draft = $state('');
  let ta = $state<HTMLTextAreaElement | undefined>(undefined);
  let mirror = $state<HTMLDivElement | undefined>(undefined);
  let pendingAsset = $state<string | undefined>(undefined);
  let moreOpen = $state(false);

  // Autocomplete state ------------------------------------------------------
  let acOpen = $state(false);
  let acItems = $state<string[]>([]);
  let acSel = $state(0);
  let acStart = $state(0); // index of the trigger char (# or @)
  let acPrefix = $state('#');

  // Live preview: a mirror div sits behind a transparent-text textarea and
  // re-renders the note the way it will read — heading lines gold serif, list
  // bullets, and #tag / @npc / [[link]] gold — as the GM types. Markers (`## `,
  // `- `) are kept but dimmed so every character still occupies the same width
  // as in the textarea, so the caret stays aligned with the rendered text.
  const highlighted = $derived(tokenHtml(draft));
  function inlineTokens(s: string): string {
    let out = escapeHtml(s);
    out = out.replace(/\[\[([^\][]+)\]\]/g, '<span class="k-wiki">[[$1]]</span>');
    out = out.replace(/(^|\s)(@[a-z0-9][a-z0-9_'-]*)/gi, '$1<span class="k-npc">$2</span>');
    out = out.replace(/(^|\s)(#[a-z0-9][a-z0-9_-]*)/gi, '$1<span class="k-tag">$2</span>');
    return out;
  }
  function tokenHtml(text: string): string {
    const lines = text.split('\n').map((line) => {
      // `## ` marker hidden (transparent, width kept so the caret stays aligned).
      const h = line.match(/^(#{1,6}\s+)(.*)$/);
      if (h) return `<span class="k-hide">${escapeHtml(h[1])}</span><span class="k-h">${inlineTokens(h[2])}</span>`;
      const todo = line.match(/^(\s*)([-*] )(\[[ xX]\])(.*)$/);
      if (todo) {
        const done = /x/i.test(todo[3]);
        return `${todo[1]}<span class="k-bul">•</span> <span class="k-mark">${escapeHtml(todo[3])}</span><span class="${done ? 'k-done' : ''}">${inlineTokens(todo[4])}</span>`;
      }
      const li = line.match(/^(\s*)([-*] )(.*)$/);
      if (li) return `${li[1]}<span class="k-bul">•</span> ${inlineTokens(li[3])}`;
      return inlineTokens(line);
    });
    return lines.join('\n') + '\n'; // trailing newline keeps the last line's height
  }
  function syncScroll() {
    if (mirror && ta) {
      mirror.scrollTop = ta.scrollTop;
      mirror.scrollLeft = ta.scrollLeft;
    }
  }

  $effect(() => {
    if (autofocus) queueMicrotask(() => ta?.focus());
  });

  function refreshAutocomplete() {
    const el = ta;
    if (!el) return;
    const pos = el.selectionStart ?? draft.length;
    const before = draft.slice(0, pos);
    const m = before.match(/([#@])([a-z0-9_'-]*)$/i);
    if (!m) {
      acOpen = false;
      return;
    }
    acPrefix = m[1];
    acStart = pos - m[0].length;
    const frag = m[2].toLowerCase();
    const pool =
      m[1] === '#'
        ? notebook.tags
        : notebook.npcNames.map((n) => n.replace(/\s+/g, '')); // @tokens are single words
    const items = pool.filter((x) => x.toLowerCase().startsWith(frag)).slice(0, 6);
    acItems = items;
    acSel = 0;
    acOpen = items.length > 0;
  }

  function applyAutocomplete(choice: string) {
    const el = ta;
    if (!el) return;
    const pos = el.selectionStart ?? draft.length;
    const insert = `${acPrefix}${choice} `;
    draft = draft.slice(0, acStart) + insert + draft.slice(pos);
    acOpen = false;
    queueMicrotask(() => {
      el.focus();
      const caret = acStart + insert.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function submit() {
    const note = notebook.add(draft);
    if (note) {
      if (pendingAsset) {
        notebook.attach(note.id, pendingAsset);
        pendingAsset = undefined;
      }
      draft = '';
      acOpen = false;
      onsaved?.();
      queueMicrotask(() => ta?.focus());
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (acOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acSel = (acSel + 1) % acItems.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        acSel = (acSel - 1 + acItems.length) % acItems.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(acItems[acSel]);
        return;
      }
      if (e.key === 'Escape') {
        acOpen = false;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function insertTemplate(id: string) {
    const tpl = TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    draft = draft ? `${draft}\n${tpl.body}` : tpl.body;
    moreOpen = false;
    queueMicrotask(() => ta?.focus());
  }

  async function pick(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    pendingAsset = await assetPut(file, file.type);
    moreOpen = false;
  }

  function onPaste(e: ClipboardEvent) {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      void pick(item.getAsFile() ?? undefined);
    }
  }
</script>

<div class="nb-cap nb-{variant}">
  <div class="nb-acwrap">
    <div class="nb-stack">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- escapeHtml runs first; only our own token spans are re-added -->
      <div class="nb-mirror" bind:this={mirror} aria-hidden="true">{@html highlighted}</div>
      <textarea
        class="nb-ta"
        bind:this={ta}
        bind:value={draft}
        rows={variant === 'hero' ? 3 : 1}
        spellcheck="false"
        placeholder={t('notebook.placeholder')}
        oninput={() => {
          refreshAutocomplete();
          syncScroll();
        }}
        onscroll={syncScroll}
        onkeydown={onKeydown}
        onpaste={onPaste}
      ></textarea>
    </div>
    {#if acOpen}
      <ul class="nb-ac">
        {#each acItems as item, i (item)}
          <li>
            <button
              class="nb-acitem"
              class:sel={i === acSel}
              onmousedown={(e) => {
                e.preventDefault();
                applyAutocomplete(item);
              }}>{acPrefix}{item}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="nb-caprow">
    <!-- one "+" menu: templates + attach image -->
    <div class="nb-more">
      <button
        class="nb-plus"
        class:on={moreOpen || pendingAsset}
        aria-label={t('notebook.more')}
        title={t('notebook.more')}
        onclick={(e) => {
          e.stopPropagation();
          moreOpen = !moreOpen;
        }}>+</button
      >
      {#if moreOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="nb-menu" onpointerdown={(e) => e.stopPropagation()}>
          <div class="nb-mhdr">{t('notebook.templates')}</div>
          {#each TEMPLATES as tpl, i (tpl.id)}
            <button class="nb-mitem" onclick={() => insertTemplate(tpl.id)}>
              <span>{t(`notebook.tpl.${tpl.id}`)}</span><span class="nb-num">{i + 1}</span>
            </button>
          {/each}
          <label class="nb-mitem nb-file">
            ▤ {t('notebook.attachImage')}
            <input type="file" accept="image/*" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
          </label>
        </div>
      {/if}
    </div>

    {#if pendingAsset}<span class="nb-pend" title={t('notebook.attachment')}>▤</span>{/if}
    <button class="nb-save" onclick={submit}>⏎ {t('notebook.save').toLowerCase()}</button>
  </div>
</div>

<svelte:window onpointerdown={() => (moreOpen = false)} />

<style>
  .nb-cap {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    width: 100%;
  }
  .nb-acwrap {
    position: relative;
    width: 100%;
  }
  /* mirror + textarea share identical box metrics so token spans line up. */
  .nb-stack {
    position: relative;
    width: 100%;
  }
  .nb-mirror,
  .nb-ta {
    box-sizing: border-box;
    display: block;
    width: 100%;
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .nb-mirror {
    position: absolute;
    inset: 0;
    border-color: transparent;
    background: transparent;
    color: var(--txt);
    overflow: hidden;
    pointer-events: none;
  }
  .nb-ta {
    position: relative;
    background: var(--bg1);
    color: transparent;
    caret-color: var(--gold);
    resize: none;
  }
  /* the hero capture is the widget's focal element → gold frame, like the mock */
  .nb-hero .nb-ta {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--fill-gold);
  }
  .nb-hero .nb-mirror,
  .nb-hero .nb-ta {
    min-height: 108px;
  }
  .nb-bar .nb-mirror,
  .nb-bar .nb-ta {
    min-height: 40px;
  }
  .nb-ta::placeholder {
    color: var(--faint);
  }
  /* live-preview token styles (mirror only) */
  .nb-mirror :global(.k-tag),
  .nb-mirror :global(.k-npc),
  .nb-mirror :global(.k-wiki) {
    color: var(--gold);
  }
  .nb-mirror :global(.k-h) {
    color: var(--txt);
    font-weight: 600;
  }
  .nb-mirror :global(.k-hide) {
    color: transparent;
  }
  .nb-mirror :global(.k-bul) {
    color: var(--gold);
  }
  .nb-mirror :global(.k-mark) {
    color: var(--faint);
  }
  .nb-mirror :global(.k-done) {
    color: var(--muted);
    text-decoration: line-through;
  }

  .nb-ac {
    position: absolute;
    z-index: 20;
    left: 8px;
    top: 100%;
    margin: 2px 0 0;
    padding: 4px;
    list-style: none;
    min-width: 160px;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--menu-bg);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
  }
  .nb-acitem {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 9px;
    border: none;
    border-radius: var(--r1);
    background: transparent;
    color: var(--txt);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .nb-acitem.sel,
  .nb-acitem:hover {
    background: var(--fill-gold);
    color: var(--gold);
  }

  .nb-caprow {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .nb-more {
    position: relative;
    flex: 0 0 auto;
  }
  .nb-plus {
    width: 28px;
    height: 28px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
  .nb-plus:hover,
  .nb-plus.on {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .nb-menu {
    position: absolute;
    z-index: 30;
    bottom: calc(100% + 4px);
    left: 0;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .nb-mhdr {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 4px 6px 2px;
  }
  .nb-mitem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--r1);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .nb-mitem:hover {
    background: var(--fill-g14);
  }
  .nb-num {
    color: var(--faint);
    font-size: 10px;
  }
  .nb-file {
    border-top: 1px solid var(--line2);
    margin-top: 3px;
    padding-top: 7px;
    color: var(--muted);
  }
  .nb-pend {
    color: var(--gold);
    font-size: 13px;
    flex: 0 0 auto;
  }
  .nb-save {
    flex: 0 0 auto;
    margin-left: auto;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    cursor: pointer;
    white-space: nowrap;
  }
  .nb-save:hover {
    color: var(--gold);
  }
</style>
