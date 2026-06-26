<script lang="ts">
  import type { WindowState } from '../lib/types';
  import { wm } from '../lib/stores/windows.svelte';
  import { getModule } from '../lib/registry';
  import { dragHandle } from '../lib/actions/drag';
  import Stub from './Stub.svelte';

  let { win }: { win: WindowState } = $props();
  const mod = $derived(getModule(win.kind));
</script>

<section
  class="win"
  data-win
  role="group"
  aria-label={win.title}
  tabindex="-1"
  style="left:{win.x}px;top:{win.y}px;width:{win.w}px;height:{win.minimized
    ? 'auto'
    : win.h + 'px'};z-index:{win.z}"
  onpointerdown={() => wm.focus(win.id)}
>
  <div class="bar" use:dragHandle={(x, y) => wm.move(win.id, x, y)}>
    <span class="dots"><i class="on"></i><i></i><i></i></span>
    <span class="t">{win.title}</span>
    <span class="ctrl">
      <button class="b" data-no-drag onclick={() => wm.toggleMin(win.id)} aria-label="Minimize">
        {win.minimized ? '▢' : '–'}
      </button>
      <button class="b x" data-no-drag onclick={() => wm.close(win.id)} aria-label="Close">✕</button>
    </span>
  </div>
  {#if !win.minimized}
    <div class="content">
      {#if mod.desktop}
        {@const Desktop = mod.desktop}
        <Desktop />
      {:else}
        <Stub moduleId={win.kind} title={mod.title} />
      {/if}
    </div>
  {/if}
</section>
