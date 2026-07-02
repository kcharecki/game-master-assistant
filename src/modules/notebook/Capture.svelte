<script lang="ts">
  import { notebook } from './store.svelte';
  import { TEMPLATES } from './logic';
  import { assetPut } from '../../lib/db';
  import { t } from '../../lib/i18n';

  let { onsaved }: { onsaved?: () => void } = $props();

  let draft = $state('');
  let ta = $state<HTMLTextAreaElement | undefined>(undefined);
  let pendingAsset = $state<string | undefined>(undefined);

  // Autocomplete state ------------------------------------------------------
  let acOpen = $state(false);
  let acItems = $state<string[]>([]);
  let acSel = $state(0);
  let acStart = $state(0); // index of the trigger char (# or @)
  let acPrefix = $state('#');

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
    queueMicrotask(() => ta?.focus());
  }

  async function pick(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    pendingAsset = await assetPut(file, file.type);
  }

  function onPaste(e: ClipboardEvent) {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      void pick(item.getAsFile() ?? undefined);
    }
  }
</script>

<div class="cap">
  <div class="ac-wrap">
    <textarea
      class="in"
      bind:this={ta}
      bind:value={draft}
      rows="2"
      placeholder={t('notebook.placeholder')}
      oninput={refreshAutocomplete}
      onkeydown={onKeydown}
      onpaste={onPaste}
    ></textarea>
    {#if acOpen}
      <ul class="ac">
        {#each acItems as item, i (item)}
          <li>
            <button
              class="ac-item"
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

  <div class="row">
    <button class="btn" onclick={submit}>{t('notebook.add')}</button>
    <label class="btn sm" class:on={pendingAsset}>
      {t('notebook.attach')}
      <input type="file" accept="image/*" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
    </label>
    <span class="tpl-label">{t('notebook.templates')}:</span>
    {#each TEMPLATES as tpl (tpl.id)}
      <button class="chip" onclick={() => insertTemplate(tpl.id)}>{t(`notebook.tpl.${tpl.id}`)}</button>
    {/each}
  </div>
</div>

<style>
  .cap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ac-wrap {
    position: relative;
  }
  .in {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    resize: vertical;
  }
  .ac {
    position: absolute;
    z-index: 20;
    left: 6px;
    top: 100%;
    margin: 2px 0 0;
    padding: 3px;
    list-style: none;
    min-width: 140px;
    border: 1px solid var(--green-dim);
    border-radius: 8px;
    background: var(--panel2);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  }
  .ac-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 4px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .ac-item.sel,
  .ac-item:hover {
    background: rgba(47, 138, 102, 0.22);
    color: var(--green);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
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
  .btn.sm {
    padding: 4px 9px;
    font-size: 12px;
  }
  .btn.sm.on {
    color: var(--green);
    border-color: var(--green);
  }
  .btn.sm input {
    display: none;
  }
  .tpl-label {
    color: var(--muted);
    font-size: 11px;
    margin-left: 4px;
  }
  .chip {
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .chip:hover {
    color: var(--green);
    border-color: var(--green-dim);
  }
</style>
