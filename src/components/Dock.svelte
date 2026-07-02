<script lang="ts">
  import type { WindowKind } from '../lib/types';
  import { moduleList } from '../lib/registry';
  import { categorized } from '../lib/categories';
  import { t } from '../lib/i18n';
  import ModuleIcon from './ModuleIcon.svelte';

  let { onAdd }: { onAdd: (kind: WindowKind) => void } = $props();

  let menuOpen = $state(false);

  // Only modules with a live desktop view make sense as spawnable windows.
  const spawnable = moduleList.filter((m) => m.desktop);
  const groups = categorized(spawnable);

  function spawn(kind: WindowKind) {
    onAdd(kind);
    menuOpen = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && menuOpen) menuOpen = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="dock">
  <div class="widget-wrap">
    {#if menuOpen}
      <div class="menu" role="menu" aria-label={t('dock.widget')}>
        <header class="tome-head">
          <span class="title">{t('dock.cabinet')}</span>
          <span class="d">&#10022;</span>
          <span class="rule"></span>
        </header>
        <div class="spread">
          {#each groups as g (g.category)}
            <div class="group">
              <div class="cat">
                <span class="name">{t('cat.' + g.category)}</span><span class="r"></span>
              </div>
              <ul>
                {#each g.items as m (m.id)}
                  <li
                    role="menuitem"
                    tabindex="0"
                    title={t('mod.' + m.id + '.title')}
                    onclick={() => spawn(m.id)}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && spawn(m.id)}
                  >
                    <span class="ico"><ModuleIcon id={m.id} size={17} /></span>
                    <span class="nm">{t('mod.' + m.id + '.title')}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    <button
      class="di add"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}><b>{t('dock.widget')}</b></button
    >
  </div>
</div>

<style>
  .widget-wrap {
    position: relative;
  }

  /* ── grimoire two-page-spread widget picker ─────────────────────────────── */
  .menu {
    position: absolute;
    bottom: 54px;
    right: 0;
    width: 468px;
    max-width: 92vw;
    padding: 18px 22px 18px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: linear-gradient(180deg, var(--bg2), var(--bg));
    box-shadow:
      0 24px 60px -18px rgba(0, 0, 0, 0.85),
      inset 0 1px 0 rgba(255, 255, 255, 0.02);
    font-family: Georgia, 'Times New Roman', serif;
  }

  .tome-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 2px 15px;
  }
  .tome-head .title {
    font-variant: small-caps;
    letter-spacing: 0.08em;
    font-size: 16px;
    color: var(--txt);
    white-space: nowrap;
  }
  .tome-head .d {
    color: var(--gold);
    font-size: 11px;
    opacity: 0.85;
  }
  .tome-head .rule {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--line2), transparent);
  }

  .spread {
    column-count: 2;
    column-gap: 30px;
    column-rule: 1px solid var(--line);
  }
  .group {
    break-inside: avoid;
    margin: 0 0 15px;
  }
  .group:last-child {
    margin-bottom: 0;
  }

  .cat {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 5px;
  }
  .cat .name {
    font-size: 10.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--green);
    white-space: nowrap;
  }
  .cat .r {
    flex: 1;
    height: 1px;
    background: var(--line);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 3px 6px 3px 4px;
    cursor: pointer;
    border-radius: 2px;
    transition:
      color 0.16s,
      background 0.16s;
  }
  li .ico {
    width: 17px;
    height: 17px;
    flex: 0 0 17px;
    color: var(--faint);
    display: flex;
    transition: color 0.16s;
  }
  li .nm {
    font-size: 13.5px;
    letter-spacing: 0.01em;
    color: var(--muted);
    line-height: 1.2;
    transition:
      color 0.16s,
      letter-spacing 0.16s;
  }
  li:hover,
  li:focus-visible {
    outline: none;
    background: linear-gradient(90deg, rgba(31, 122, 79, 0.12), transparent);
  }
  li:hover .nm,
  li:focus-visible .nm {
    color: var(--green);
    letter-spacing: 0.03em;
  }
  li:hover .ico,
  li:focus-visible .ico {
    color: var(--eye);
  }
</style>
