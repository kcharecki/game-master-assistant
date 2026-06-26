<script lang="ts">
  import type { WindowState } from '../lib/types';
  import { wm } from '../lib/stores/windows.svelte';
  import { getModule } from '../lib/registry';
  import { dragHandle } from '../lib/actions/drag';
  import { resizeHandle } from '../lib/actions/resize';
  import Stub from './Stub.svelte';

  let { win }: { win: WindowState } = $props();
  const mod = $derived(getModule(win.kind));
</script>

{#if !win.minimized}
  <section
    class="win"
    data-win
    role="group"
    aria-label={win.title}
    tabindex="-1"
    style="left:{win.x}px;top:{win.y}px;width:{win.w}px;height:{win.h}px;z-index:{win.z}"
    onpointerdown={() => wm.focus(win.id)}
  >
    <div class="bar" use:dragHandle={(x, y) => wm.move(win.id, x, y)}>
      <span class="dots"><i class="on"></i><i></i><i></i></span>
      <span class="t">{win.title}</span>
      <span class="ctrl">
        <button class="b" data-no-drag onclick={() => wm.toggleMin(win.id)} aria-label="Minimize">
          –
        </button>
        <button class="b x" data-no-drag onclick={() => wm.close(win.id)} aria-label="Close">✕</button
        >
      </span>
    </div>
    <div class="content">
      {#if mod.desktop}
        {@const Desktop = mod.desktop}
        <Desktop />
      {:else}
        <Stub moduleId={win.kind} title={mod.title} />
      {/if}
    </div>
    <span
      class="grip"
      data-no-drag
      aria-label="Resize"
      use:resizeHandle={(w, h) => wm.resize(win.id, w, h)}
    ></span>
  </section>
{/if}

<style>
  .grip {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(
      135deg,
      transparent 0 50%,
      var(--line2) 50% 60%,
      transparent 60% 72%,
      var(--line2) 72% 82%,
      transparent 82%
    );
  }
</style>
