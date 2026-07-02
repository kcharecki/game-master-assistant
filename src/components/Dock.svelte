<script lang="ts">
  import { moduleList } from '../lib/registry';
  import { categorized } from '../lib/categories';
  import { wm } from '../lib/stores/windows.svelte';
  import { t } from '../lib/i18n';
  import ModuleIcon from './ModuleIcon.svelte';

  // Only modules with a live desktop view make sense as spawnable windows.
  const spawnable = moduleList.filter((m) => m.desktop);
  const groups = categorized(spawnable);

  // Which modules currently have a window (open or minimized) — drives the
  // running-dot indicator, like a macOS dock.
  const open = $derived(new Set(wm.windows.map((w) => w.kind)));
</script>

<div class="dock">
  <div class="rail" role="toolbar" aria-label={t('dock.widgets')}>
    {#each groups as g, gi (g.category)}
      {#if gi > 0}<span class="pipe" aria-hidden="true"></span>{/if}
      {#each g.items as m (m.id)}
        <button
          class="tile"
          class:active={open.has(m.id)}
          title={t('mod.' + m.id + '.title')}
          onclick={() => wm.toggle(m.id, 120, 120)}
        >
          <span class="ico"><ModuleIcon id={m.id} size={22} /></span>
          <span class="nm">{t('mod.' + m.id + '.title')}</span>
          <span class="run" aria-hidden="true"></span>
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  /* Flat, always-on macOS-style dock: every widget as an icon-over-label tile,
     laid out in a single row, category sections split by thin pipe separators.
     Fonts + palette carried over from the old "Cabinet" picker (serif labels,
     séance green). */
  .rail {
    display: flex;
    align-items: stretch;
    gap: 1px;
    max-width: calc(100vw - 40px);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--line2) transparent;
    font-family: Georgia, 'Times New Roman', serif;
  }
  .rail::-webkit-scrollbar {
    height: 6px;
  }
  .rail::-webkit-scrollbar-thumb {
    background: var(--line2);
    border-radius: 3px;
  }
  .rail::-webkit-scrollbar-track {
    background: transparent;
  }

  .pipe {
    flex: 0 0 auto;
    align-self: center;
    width: 1px;
    height: 34px;
    margin: 0 7px;
    background: linear-gradient(180deg, transparent, var(--line2) 20%, var(--line2) 80%, transparent);
  }

  .tile {
    position: relative;
    flex: 0 0 auto;
    width: 66px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 6px 4px 8px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.16s,
      border-color 0.16s;
  }
  /* macOS-style "running" dot for a module that has a window open. */
  .run {
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: transparent;
    transition: background 0.16s;
  }
  .tile.active .run {
    background: var(--green);
    box-shadow: 0 0 5px var(--green-glow);
  }
  .tile.active .ico {
    color: var(--green);
  }
  .tile .ico {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    color: var(--faint);
    transition:
      color 0.16s,
      transform 0.14s;
  }
  .tile .nm {
    min-height: 2.2em;
    display: flex;
    align-items: center;
    font-size: 9.5px;
    line-height: 1.12;
    letter-spacing: 0.01em;
    text-align: center;
    color: var(--muted);
    transition: color 0.16s;
  }
  .tile:hover,
  .tile:focus-visible {
    outline: none;
    background: radial-gradient(120% 80% at 50% 15%, rgba(31, 122, 79, 0.18), transparent 70%);
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
