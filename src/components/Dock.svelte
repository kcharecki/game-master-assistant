<script lang="ts">
  import type { WindowKind } from '../lib/types';
  import { moduleList } from '../lib/registry';
  import { categorized, infoFor } from '../lib/categories';
  import { t } from '../lib/i18n';

  let {
    onReveal,
    onAdd,
  }: { onReveal: () => void; onAdd: (kind: WindowKind) => void } = $props();

  let menuOpen = $state(false);

  // Only modules with a live desktop view make sense as spawnable windows.
  const spawnable = moduleList.filter((m) => m.desktop);
  const groups = categorized(spawnable);

  function spawn(kind: WindowKind) {
    onAdd(kind);
    menuOpen = false;
  }
</script>

<div class="dock">
  <button class="di"><b>{t('dock.narrate')}</b></button>
  <button class="di" onclick={onReveal}><b>{t('dock.reveal')}</b></button>
  <button class="di" onclick={() => onAdd('npcs')}><b>{t('dock.addNpc')}</b></button>
  <button class="di" onclick={() => onAdd('roller')}><b>{t('dock.roll')}</b></button>
  <button class="di" onclick={() => onAdd('timer')}><b>{t('dock.timer')}</b></button>
  <button class="di" onclick={() => onAdd('conditions')}><b>{t('dock.conditions')}</b></button>
  <div class="sep"></div>
  <div class="widget-wrap">
    {#if menuOpen}
      <div class="menu" role="menu" aria-label="Add widget">
        {#each groups as g (g.category)}
          <div class="cat">
            <div class="cat-head">{t('cat.' + g.category)}</div>
            <div class="grid">
              {#each g.items as m (m.id)}
                <button
                  class="tile"
                  role="menuitem"
                  aria-label={t('mod.' + m.id + '.title')}
                  onclick={() => spawn(m.id)}
                >
                  <span class="glyph" aria-hidden="true">{infoFor(m.id).icon}</span>
                  <span class="label">{t('mod.' + m.id + '.title')}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
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
  .menu {
    position: absolute;
    bottom: 54px;
    right: 0;
    width: 360px;
    max-height: 66vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.96);
    backdrop-filter: blur(9px);
    box-shadow: 0 16px 44px -16px rgba(0, 0, 0, 0.9);
  }
  .cat-head {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0 2px 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    min-height: 64px;
  }
  .tile:hover {
    background: rgba(47, 138, 102, 0.16);
    border-color: var(--green-dim);
  }
  .glyph {
    font-size: 20px;
    line-height: 1;
  }
  .label {
    font-size: 10px;
    line-height: 1.2;
    text-align: center;
    color: var(--muted);
  }
  .tile:hover .label {
    color: var(--txt);
  }
</style>
