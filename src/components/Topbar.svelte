<script lang="ts">
  import { onMount } from 'svelte';
  import { system } from '../lib/stores/system.svelte';
  import { SYSTEMS, systemConfig } from '../lib/system';
  import { layouts } from '../lib/stores/layouts.svelte';
  import { wm } from '../lib/stores/windows.svelte';
  import { lang, t } from '../lib/i18n';

  let { onOpenBroadcast }: { onOpenBroadcast: () => void } = $props();

  let menuOpen = $state(false);
  let newName = $state('');

  onMount(() => {
    void system.load().then(() => layouts.load());
  });

  // Reload presets whenever the active system changes (presets are per-system).
  $effect(() => {
    void system.current;
    void layouts.load();
  });

  function saveCurrent() {
    const name = newName.trim();
    if (!name) return;
    void layouts.save(name);
    newName = '';
  }

  function tileWindows() {
    const desk = document.getElementById('desktop');
    const w = desk?.clientWidth ?? window.innerWidth;
    const h = desk?.clientHeight ?? window.innerHeight;
    wm.tile(w, h);
  }
</script>

<header class="topbar">
  <div class="brand">GM Assistant<small>CTHULHU EDITION</small></div>
  <span class="pill">The Haunting of Blackwater Creek</span>
  <span class="spacer"></span>
  <div class="sysswitch" role="group" aria-label="Game system">
    {#each SYSTEMS as s (s)}
      <button
        class="sysbtn"
        class:on={system.current === s}
        aria-pressed={system.current === s}
        onclick={() => system.set(s)}>{systemConfig(s).label}</button
      >
    {/each}
  </div>
  <div class="sysswitch" role="group" aria-label="Language">
    <button
      class="sysbtn"
      class:on={lang.current === 'en'}
      aria-pressed={lang.current === 'en'}
      onclick={() => lang.set('en')}>EN</button
    >
    <button
      class="sysbtn"
      class:on={lang.current === 'pl'}
      aria-pressed={lang.current === 'pl'}
      onclick={() => lang.set('pl')}>PL</button
    >
  </div>
  <button class="btn" aria-label="Tile windows" onclick={tileWindows}>{t('topbar.tile')}</button>
  <span class="pill">Session 02:34:17</span>
  <div class="layouts">
    <button
      class="btn"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}>{t('topbar.layouts')}</button
    >
    {#if menuOpen}
      <div class="lmenu" role="menu">
        <div class="lhead">{systemConfig(system.current).label} {t('topbar.layoutsHeader')}</div>
        {#if layouts.presets.length === 0}
          <div class="lempty">{t('topbar.noLayouts')}</div>
        {/if}
        {#each layouts.presets as p (p.name)}
          <div class="lrow">
            <button class="lname" role="menuitem" onclick={() => layouts.restore(p.name)}
              >{p.name}</button
            >
            <button class="ldel" aria-label="Delete {p.name}" onclick={() => layouts.remove(p.name)}
              >✕</button
            >
          </div>
        {/each}
        <div class="lsave">
          <input
            class="lin"
            bind:value={newName}
            placeholder={t('topbar.saveAs')}
            onkeydown={(e) => e.key === 'Enter' && saveCurrent()}
          />
          <button class="lsavebtn" onclick={saveCurrent}>{t('topbar.save')}</button>
        </div>
      </div>
    {/if}
  </div>
  <button class="btn" onclick={onOpenBroadcast}>{t('topbar.openBroadcast')}</button>
</header>

<style>
  .sysswitch {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
  }
  .sysbtn {
    padding: 4px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .sysbtn:hover {
    color: var(--txt);
  }
  .sysbtn.on {
    background: rgba(47, 138, 102, 0.22);
    color: var(--txt);
  }
  .layouts {
    position: relative;
  }
  .lmenu {
    position: absolute;
    top: 38px;
    right: 0;
    z-index: 9500;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.98);
    box-shadow: 0 16px 44px -16px rgba(0, 0, 0, 0.9);
  }
  .lhead {
    color: var(--faint);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 2px 6px 6px;
  }
  .lempty {
    color: var(--faint);
    font-size: 12px;
    padding: 4px 6px;
  }
  .lrow {
    display: flex;
    align-items: center;
  }
  .lname {
    flex: 1;
    text-align: left;
    padding: 7px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font-size: 13px;
  }
  .lname:hover {
    background: rgba(47, 138, 102, 0.16);
  }
  .ldel {
    border: 0;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    padding: 4px 8px;
  }
  .ldel:hover {
    color: var(--txt);
  }
  .lsave {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .lin {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .lsavebtn {
    border: 1px solid var(--line2);
    border-radius: 8px;
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
    cursor: pointer;
    font-size: 12px;
    padding: 0 10px;
  }
</style>
