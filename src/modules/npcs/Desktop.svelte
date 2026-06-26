<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';
  import { filterNpcs } from './roster';
  import { assetUrl } from '../../lib/db';

  const rep: Record<Disposition, string> = { ally: '+', neutral: '·', hostile: '–' };

  let query = $state('');
  const shown = $derived(filterNpcs(npcs.list, query));

  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set(npcs.list.map((n) => n.portraitId).filter(Boolean) as string[]);
    for (const [id, url] of Object.entries(urls)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete urls[id];
      }
    }
    for (const id of want) {
      if (!urls[id]) {
        void assetUrl(id).then((u) => {
          if (u) urls[id] = u;
        });
      }
    }
  });
</script>

<input class="npcsearch" bind:value={query} placeholder="Search NPCs…" />

{#each shown as n (n.id)}
  <div class="combatant" class:foe={n.disposition === 'hostile'}>
    <span class="av">
      {#if n.portraitId && urls[n.portraitId]}
        <img class="avimg" src={urls[n.portraitId]} alt="" />
      {:else}
        {n.name.slice(0, 2).toUpperCase()}
      {/if}
    </span>
    <span class="cn"><div class="nm">{n.name}</div><div class="rl">{n.role || n.disposition}</div></span>
    <span class="iv">{rep[n.disposition]}</span>
  </div>
{/each}

<style>
  .npcsearch {
    width: 100%;
    margin-bottom: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 13px;
  }
  .av {
    overflow: hidden;
    padding: 0;
  }
  .avimg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
