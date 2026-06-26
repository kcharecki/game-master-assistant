<script lang="ts">
  import { onMount } from 'svelte';
  import type { ModuleId } from '../lib/module';
  import { wm } from '../lib/stores/windows.svelte';
  import WindowFrame from '../components/WindowFrame.svelte';
  import Dock from '../components/Dock.svelte';

  let { onOpenEditor }: { onOpenEditor: (id: ModuleId) => void } = $props();

  onMount(async () => {
    await wm.load();
    if (wm.windows.length === 0) seed();
  });

  function seed() {
    wm.add('scene', 22, 20);
    wm.add('initiative', 384, 20);
    wm.add('roller', 702, 20);
    wm.add('npcs', 384, 338);
    wm.add('handouts', 702, 356);
    wm.add('notebook', 22, 470);
  }
</script>

<div class="desktop" id="desktop">
  <div class="wp grid"></div>
  <div class="wp vig"></div>
  <div class="hint">drag windows · ＋ from dock · screen-share the broadcast tab</div>

  {#each wm.windows as win (win.id)}
    <WindowFrame {win} />
  {/each}

  <Dock onReveal={() => onOpenEditor('reveal')} onAdd={(k) => wm.add(k, 120, 120)} />
</div>
