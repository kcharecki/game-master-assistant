<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';

  const rep: Record<Disposition, string> = { ally: '+', neutral: '·', hostile: '–' };
</script>

{#each npcs.list as n (n.id)}
  <div class="combatant" class:foe={n.disposition === 'hostile'}>
    <span class="av">{n.name.slice(0, 2).toUpperCase()}</span>
    <span class="cn"><div class="nm">{n.name}</div><div class="rl">{n.role || n.disposition}</div></span>
    <span class="iv">{rep[n.disposition]}</span>
  </div>
{/each}
