<script lang="ts">
  import type { WindowKind } from '../lib/types';

  let {
    onReveal,
    onAdd,
  }: { onReveal: () => void; onAdd: (kind: WindowKind) => void } = $props();

  // ＋ Widget launcher cycles through spawnable modules for now.
  const spawnable: WindowKind[] = ['map', 'audio', 'clues', 'reveal'];
  let next = $state(0);
  function addWidget() {
    onAdd(spawnable[next % spawnable.length]);
    next += 1;
  }
</script>

<div class="dock">
  <button class="di"><b>Narrate</b></button>
  <button class="di" onclick={onReveal}><b>Reveal</b></button>
  <button class="di" onclick={() => onAdd('npcs')}><b>Add NPC</b></button>
  <button class="di"><b>Roll</b></button>
  <button class="di"><b>Timer</b></button>
  <button class="di"><b>Conditions</b></button>
  <div class="sep"></div>
  <button class="di add" onclick={addWidget}><b>＋ Widget</b></button>
</div>
