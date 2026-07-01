<script lang="ts">
  import type { WindowKind } from '../lib/types';
  import { moduleList } from '../lib/registry';
  import { categorized } from '../lib/categories';
  import { t } from '../lib/i18n';
  import ModuleIcon from './ModuleIcon.svelte';

  let {
    onReveal,
    onAdd,
  }: { onReveal: () => void; onAdd: (kind: WindowKind) => void } = $props();

  let menuOpen = $state(false);
  let query = $state('');
  let searchEl = $state<HTMLInputElement>();

  // Only modules with a live desktop view make sense as spawnable windows.
  const spawnable = moduleList.filter((m) => m.desktop);
  const groups = categorized(spawnable);

  // Live filter by localized title; drop categories left with no matches.
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((m) => t('mod.' + m.id + '.title').toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  });

  // Flat list of what's currently shown, in display order — for Enter-to-spawn.
  const visible = $derived(filtered.flatMap((g) => g.items));

  function open() {
    menuOpen = true;
    query = '';
    // Focus the filter after the menu paints so typing works immediately.
    requestAnimationFrame(() => searchEl?.focus());
  }

  function spawn(kind: WindowKind) {
    onAdd(kind);
    menuOpen = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      menuOpen = false;
    } else if (e.key === 'Enter' && visible.length) {
      spawn(visible[0].id);
    }
  }
</script>

<div class="dock">
  <button class="di"><b>{t('dock.narrate')}</b></button>
  <button class="di" onclick={onReveal}><b>{t('dock.reveal')}</b></button>
  <button class="di" onclick={() => onAdd('npcs')}><b>{t('dock.addNpc')}</b></button>
  <button class="di" onclick={() => onAdd('roller')}><b>{t('dock.roll')}</b></button>
  <button class="di" onclick={() => onAdd('timer')}><b>{t('dock.timer')}</b></button>
  <div class="sep"></div>
  <div class="widget-wrap">
    {#if menuOpen}
      <div class="menu" role="menu" aria-label="Add widget">
        <input
          class="search"
          bind:this={searchEl}
          bind:value={query}
          onkeydown={onKey}
          type="text"
          placeholder={t('dock.searchWidgets')}
          aria-label={t('dock.searchWidgets')}
        />
        <div class="scroll">
          {#each filtered as g (g.category)}
            <div class="cat">
              <div class="cat-head">{t('cat.' + g.category)}</div>
              <div class="grid">
                {#each g.items as m (m.id)}
                  <button
                    class="tile"
                    role="menuitem"
                    title={t('mod.' + m.id + '.title')}
                    aria-label={t('mod.' + m.id + '.title')}
                    onclick={() => spawn(m.id)}
                  >
                    <span class="glyph"><ModuleIcon id={m.id} /></span>
                    <span class="label">{t('mod.' + m.id + '.title')}</span>
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="empty">{t('dock.noWidgets')}</div>
          {/each}
        </div>
      </div>
    {/if}
    <button
      class="di add"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen ? (menuOpen = false) : open())}><b>{t('dock.widget')}</b></button
    >
  </div>
</div>

<style>
  .widget-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    bottom: 54px;
    right: 0;
    width: 320px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.96);
    backdrop-filter: blur(9px);
    box-shadow: 0 16px 44px -16px rgba(0, 0, 0, 0.9);
  }
  .search {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 8px;
    padding: 6px 9px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.35);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .search:focus {
    outline: none;
    border-color: var(--green-dim);
  }
  .scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cat-head {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0 2px 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 2px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 2px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
  }
  .tile:hover {
    background: rgba(47, 138, 102, 0.16);
    border-color: var(--green-dim);
  }
  .glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    color: var(--green, #5fbf8f);
    opacity: 0.85;
  }
  .tile:hover .glyph {
    color: var(--eye, #46e89a);
    opacity: 1;
  }
  .label {
    font-size: 9px;
    line-height: 1.15;
    text-align: center;
    color: var(--muted);
  }
  .tile:hover .label {
    color: var(--txt);
  }
  .empty {
    padding: 14px 4px;
    text-align: center;
    font-size: 12px;
    color: var(--faint, #6f6a5c);
  }
</style>
