<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';
  import { filterNpcs } from './roster';
  import { assetUrl } from '../../lib/db';
  import { loc, type LocalizedText } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import { t } from '../../lib/i18n';
  import NpcPeek from '../../lib/components/NpcPeek.svelte';

  const rep: Record<Disposition, string> = { ally: '+', neutral: '·', hostile: '–' };
  const g = (v: LocalizedText | undefined) => loc(v, lang.current);

  // GM cheatsheet: hover a roster row to peek the NPC's full record (no broadcast).
  let peek: ReturnType<typeof NpcPeek> | undefined;

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

  // Revoke any object URLs still held when the window unmounts (no leak on close).
  $effect(() => () => {
    for (const url of Object.values(urls)) URL.revokeObjectURL(url);
  });
</script>

<input class="npcsearch" bind:value={query} placeholder={t('npcs.searchDesktop')} />

{#each shown as n (n.id)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="combatant"
    class:foe={n.disposition === 'hostile'}
    onpointerenter={(e) => peek?.schedule(e.currentTarget, n.id)}
    onpointerleave={() => peek?.scheduleClose()}
  >
    <span class="av">
      {#if n.portraitId && urls[n.portraitId]}
        <img class="avimg" src={urls[n.portraitId]} alt="" />
      {:else}
        {g(n.name).slice(0, 2).toUpperCase()}
      {/if}
    </span>
    <span class="cn"><div class="nm">{g(n.name)}</div><div class="rl">{g(n.role) || t('npcs.disposition.' + n.disposition)}</div></span>
    <span class="iv">{rep[n.disposition]}</span>
  </div>
{/each}

<NpcPeek bind:this={peek} />

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
