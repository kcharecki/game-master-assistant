<script lang="ts">
  import { onMount } from 'svelte';
  import { wm } from '../lib/stores/windows.svelte';
  import WindowFrame from '../components/WindowFrame.svelte';
  import Dock from '../components/Dock.svelte';

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

  <Dock />
</div>

