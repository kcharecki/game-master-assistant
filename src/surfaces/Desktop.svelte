<script lang="ts">
  import { onMount } from 'svelte';
  import type { ModuleId } from '../lib/module';
  import { wm } from '../lib/stores/windows.svelte';
  import WindowFrame from '../components/WindowFrame.svelte';
  import Dock from '../components/Dock.svelte';
  import { t } from '../lib/i18n';

  let { onOpenEditor }: { onOpenEditor: (id: ModuleId) => void } = $props();

  onMount(async () => {
    await wm.load();
    if (wm.windows.length === 0) seed();
  });

  function seed() {
    wm.add('initiative', 22, 20);
    wm.add('roller', 384, 20);
    wm.add('npcs', 702, 20);
    wm.add('handouts', 384, 338);
    wm.add('notebook', 22, 470);
  }
</script>

<div class="desktop" id="desktop">
  <div class="wp grid"></div>
  <div class="wp fog"></div>
  <div class="wp grain"></div>
  <div class="wp vig2"></div>
  <div class="wp vig"></div>
  <div class="hint">drag windows · ＋ from dock · screen-share the broadcast tab</div>

  {#each wm.windows as win (win.id)}
    <WindowFrame {win} />
  {/each}

  {#if wm.windows.some((w) => w.minimized)}
    <div class="mindock">
      {#each wm.windows.filter((w) => w.minimized) as win (win.id)}
        <button
          class="minchip"
          onclick={() => wm.toggleMin(win.id)}
          title={t('win.expand') + ' ' + t('mod.' + win.kind + '.title')}
        >
          {t('mod.' + win.kind + '.title')}
        </button>
      {/each}
    </div>
  {/if}

  <Dock onReveal={() => onOpenEditor('reveal')} onAdd={(k) => wm.add(k, 120, 120)} />
</div>

<style>
  .mindock {
    position: absolute;
    left: 14px;
    bottom: 13px;
    z-index: 9000;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 40%;
  }
  .minchip {
    padding: 7px 12px;
    border-radius: 10px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.78);
    backdrop-filter: blur(9px);
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .minchip:hover {
    color: var(--txt);
    background: rgba(47, 138, 102, 0.16);
    border-color: var(--green-dim);
  }
</style>
