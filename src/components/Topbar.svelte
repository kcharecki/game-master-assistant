<script lang="ts">
  import { onMount } from 'svelte';
  import { system } from '../lib/stores/system.svelte';
  import { SYSTEMS, systemConfig } from '../lib/system';
  import { layouts } from '../lib/stores/layouts.svelte';
  import { wm } from '../lib/stores/windows.svelte';
  import { lang, t } from '../lib/i18n';
  import { density } from '../lib/stores/density.svelte';
  import { onair } from '../lib/stores/onair.svelte';
  import { session } from '../lib/stores/session.svelte';
  import Icon from '../lib/components/Icon.svelte';

  let { onOpenBroadcast }: { onOpenBroadcast: () => void } = $props();

  let menuOpen = $state(false);
  let newName = $state('');

  onMount(() => {
    void system.load().then(() => layouts.load());
    void onair.load();
    void session.load();
  });

  // Commit the session title on blur / Enter; blur on Enter to confirm.
  function commitTitle(e: Event) {
    session.set((e.currentTarget as HTMLInputElement).value.trim() || session.title);
  }

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
  <input
    class="titlein"
    value={session.title}
    aria-label={t('topbar.sessionTitle')}
    title={t('topbar.sessionTitle')}
    onblur={commitTitle}
    onkeydown={(e) => {
      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    }}
  />

  <div class="onair" class:live={onair.info.live}>
    <span class="lamp"><span class="dot"></span>{onair.info.live ? t('onair.live') : t('onair.off')}</span>
    {#if onair.info.live}
      <span class="airlabel" title={onair.info.label}>{onair.info.label}</span>
    {/if}
    <button
      class="panic"
      title={t('onair.panicTitle')}
      aria-label={t('onair.panicTitle')}
      onclick={() => onair.clear()}>{t('onair.panic')}</button
    >
  </div>

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
  <button
    class="ic"
    aria-label={t('topbar.density')}
    title={density.current === 'compact' ? t('topbar.densityComfortable') : t('topbar.densityCompact')}
    onclick={() => density.toggle()}><Icon name="density" /></button
  >
  <button class="btn" aria-label={t('topbar.tile')} title={t('topbar.tile')} onclick={tileWindows}
    ><Icon name="tile" /> {t('topbar.tile')}</button
  >
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
            <button
              class="ic danger ldel"
              aria-label="{t('win.delete')} {p.name}"
              title={t('win.delete')}
              onclick={() => layouts.remove(p.name)}><Icon name="trash" size={13} /></button
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
  <button class="btn" title={t('topbar.openBroadcast')} onclick={onOpenBroadcast}
    ><Icon name="open" /> {t('topbar.openBroadcast')}</button
  >
</header>

<style>
  .titlein {
    min-width: 0;
    max-width: 320px;
    flex-shrink: 1;
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: var(--r2);
    background: transparent;
    color: var(--txt);
    font-family: var(--serif);
    font-size: 15px;
    letter-spacing: 0.01em;
    text-overflow: ellipsis;
  }
  .titlein:hover {
    border-color: var(--line2);
  }
  .titlein:focus {
    outline: none;
    border-color: var(--green);
    background: var(--bg1);
  }
  .sysswitch {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
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
    background: var(--fill-g22);
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
    padding: 4px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
  }
  .lhead {
    color: var(--faint);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
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
    height: var(--menu-item);
    padding: 0 10px;
    border: 0;
    border-radius: var(--r1);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font-size: 13px;
  }
  .lname:hover {
    background: var(--fill-g14);
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
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .lsavebtn {
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--fill-g14);
    color: var(--txt);
    cursor: pointer;
    font-size: 12px;
    padding: 0 10px;
  }
</style>
