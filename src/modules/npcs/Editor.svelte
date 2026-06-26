<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';
  import { filterNpcs } from './roster';
  import { assetPut, assetUrl } from '../../lib/db';

  const dispositions: Disposition[] = ['ally', 'neutral', 'hostile'];

  let query = $state('');
  const shown = $derived(filterNpcs(npcs.list, query));

  // Resolve portrait asset ids -> object URLs, revoking old ones on change.
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

  // Revoke any object URLs still held when the editor unmounts (no leak on close).
  $effect(() => () => {
    for (const url of Object.values(urls)) URL.revokeObjectURL(url);
  });

  async function pickPortrait(npcId: string, file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.update(npcId, { portraitId: assetId });
  }
</script>

<div class="editor">
  <header class="ehead">
    <h2>NPC Roster</h2>
    <div class="hbtns">
      <button class="btn" onclick={() => npcs.addGenerated()}>🎲 Generate</button>
      <button class="btn solid" onclick={() => npcs.add()}>＋ New NPC</button>
    </div>
  </header>

  <input class="in search" bind:value={query} placeholder="Search name / role / disposition…" />

  <div class="grid">
    {#each shown as n (n.id)}
      <div class="card">
        <div class="portrow">
          <label class="port" title="Upload portrait">
            {#if n.portraitId && urls[n.portraitId]}
              <img class="pimg" src={urls[n.portraitId]} alt="{n.name} portrait" />
            {:else}
              <span class="pinit">{n.name.slice(0, 2).toUpperCase() || '??'}</span>
            {/if}
            <input
              type="file"
              accept="image/*"
              hidden
              onchange={(e) => void pickPortrait(n.id, e.currentTarget.files?.[0])}
            />
          </label>
          <input
            class="in name"
            value={n.name}
            oninput={(e) => npcs.update(n.id, { name: e.currentTarget.value })}
            placeholder="Name"
          />
        </div>
        <input
          class="in"
          value={n.role}
          oninput={(e) => npcs.update(n.id, { role: e.currentTarget.value })}
          placeholder="Role / location"
        />
        <input
          class="in"
          value={n.voice ?? ''}
          oninput={(e) => npcs.update(n.id, { voice: e.currentTarget.value })}
          placeholder="Voice / accent notes"
        />
        <div class="rowflex">
          <select
            class="in"
            value={n.disposition}
            onchange={(e) => npcs.update(n.id, { disposition: e.currentTarget.value as Disposition })}
          >
            {#each dispositions as d (d)}<option value={d}>{d}</option>{/each}
          </select>
          <button class="btn" onclick={() => npcs.remove(n.id)}>Delete</button>
        </div>
      </div>
    {/each}
    {#if shown.length === 0}
      <p class="muted empty">No NPCs match “{query}”.</p>
    {/if}
  </div>
</div>

<style>
  .editor {
    padding: 22px 26px;
    overflow: auto;
    height: 100%;
  }
  .ehead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .ehead h2 {
    font-family: Georgia, serif;
    font-size: 22px;
    color: #e9f3ed;
  }
  .hbtns {
    display: flex;
    gap: 8px;
  }
  .search {
    margin-bottom: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
    background: var(--panel2);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .portrow {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .port {
    flex: 0 0 auto;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
    overflow: hidden;
    cursor: pointer;
  }
  .pimg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .pinit {
    font: 600 14px Georgia, serif;
    color: var(--green);
    letter-spacing: 1px;
  }
  .in {
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .in.name {
    font-weight: 600;
  }
  .rowflex {
    display: flex;
    gap: 8px;
  }
  .empty {
    grid-column: 1 / -1;
  }
</style>
