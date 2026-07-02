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
        <div class="groups">
          {#each groups as g (g.category)}
            <div class="group">
              <div class="cat">
                <span class="name">{t('cat.' + g.category)}</span><span class="r"></span>
              </div>
              <div class="tiles">
                {#each g.items as m (m.id)}
                  <button
                    class="tile"
                    role="menuitem"
                    title={t('mod.' + m.id + '.title')}
                    onclick={() => spawn(m.id)}
                  >
                    <span class="ico"><ModuleIcon id={m.id} size={24} /></span>
                    <span class="nm">{t('mod.' + m.id + '.title')}</span>
                  </button>
                {/each}
              </div>
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

  /* ── grimoire launchpad: icon-over-label tiles grouped by category ──────── */
  .menu {
    position: absolute;
    bottom: 54px;
    right: 0;
    width: 480px;
    max-width: 92vw;
    padding: 18px 20px 16px;
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
    margin: 0 2px 14px;
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

  .groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cat {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cat .name {
    font-size: 10px;
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

  /* the "dock" strip of tiles for a category */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, 78px);
    gap: 4px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 78px;
    padding: 9px 4px 8px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.16s,
      border-color 0.16s,
      transform 0.12s;
  }
  .tile .ico {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    color: var(--faint);
    transition:
      color 0.16s,
      transform 0.14s;
  }
  .tile .nm {
    font-size: 10.5px;
    line-height: 1.15;
    text-align: center;
    letter-spacing: 0.01em;
    color: var(--muted);
    transition: color 0.16s;
  }
  .tile:hover,
  .tile:focus-visible {
    outline: none;
    background: radial-gradient(120% 90% at 50% 20%, rgba(31, 122, 79, 0.18), transparent 70%);
    border-color: var(--line2);
  }
  .tile:hover .ico,
  .tile:focus-visible .ico {
    color: var(--eye);
    transform: translateY(-2px);
  }
  .tile:hover .nm,
  .tile:focus-visible .nm {
    color: var(--green);
  }
</style>
