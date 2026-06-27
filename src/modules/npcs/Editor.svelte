<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';
  import { filterNpcs } from './roster';
  import { assetPut, assetUrl } from '../../lib/db';

  const dispositions: Disposition[] = ['ally', 'neutral', 'hostile'];

  let query = $state('');
  const shown = $derived(filterNpcs(npcs.list, query));

  // Which cards have their detail panel expanded.
  let open = $state<Record<string, boolean>>({});

  // Resolve every referenced asset id (primary + gallery) -> object URL,
  // revoking old ones on change.
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    for (const n of npcs.list) {
      if (n.portraitId) want.add(n.portraitId);
      for (const g of n.gallery ?? []) want.add(g);
    }
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
    npcs.setPrimaryPhoto(npcId, assetId);
  }

  async function addToGallery(npcId: string, file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.addPhoto(npcId, assetId);
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
          <button
            class="btn"
            aria-expanded={!!open[n.id]}
            onclick={() => (open[n.id] = !open[n.id])}
          >
            {open[n.id] ? 'Hide' : 'Details'}
          </button>
          <button class="btn" onclick={() => npcs.remove(n.id)}>Delete</button>
        </div>

        {#if open[n.id]}
          <div class="detail">
            <!-- Gallery -->
            <section>
              <div class="seclabel">Gallery</div>
              <div class="thumbs">
                {#each n.gallery ?? [] as gid (gid)}
                  <div class="thumb" class:primary={gid === n.portraitId}>
                    {#if urls[gid]}
                      <button
                        type="button"
                        class="thumbpick"
                        title="Set as primary"
                        onclick={() => npcs.setPrimaryPhoto(n.id, gid)}
                      >
                        <img src={urls[gid]} alt="" />
                      </button>
                    {/if}
                    <button
                      type="button"
                      class="thumbx"
                      aria-label="Remove photo"
                      onclick={() => npcs.removePhoto(n.id, gid)}>×</button
                    >
                  </div>
                {/each}
                <label class="thumb addthumb" title="Add photo">
                  ＋
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onchange={(e) => void addToGallery(n.id, e.currentTarget.files?.[0])}
                  />
                </label>
              </div>
            </section>

            <!-- Equipment -->
            <section>
              <div class="seclabel">
                Equipment
                <button class="mini" onclick={() => npcs.addEquip(n.id)}>＋ row</button>
              </div>
              {#each n.equipment ?? [] as it (it.id)}
                <div class="equiprow">
                  <input
                    class="in"
                    value={it.name}
                    oninput={(e) => npcs.updateEquip(n.id, it.id, { name: e.currentTarget.value })}
                    placeholder="Item"
                  />
                  <input
                    class="in qty"
                    type="number"
                    value={it.qty ?? ''}
                    oninput={(e) =>
                      npcs.updateEquip(n.id, it.id, {
                        qty: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value),
                      })}
                    placeholder="Qty"
                  />
                  <input
                    class="in"
                    value={it.notes ?? ''}
                    oninput={(e) => npcs.updateEquip(n.id, it.id, { notes: e.currentTarget.value })}
                    placeholder="Notes"
                  />
                  <button class="mini" aria-label="Remove item" onclick={() => npcs.removeEquip(n.id, it.id)}>×</button>
                </div>
              {/each}
            </section>

            <!-- Stats -->
            <section>
              <div class="seclabel">
                Stats
                <button class="mini" onclick={() => npcs.addStat(n.id)}>＋ row</button>
              </div>
              {#each n.stats ?? [] as s (s.id)}
                <div class="statrow">
                  <input
                    class="in"
                    value={s.key}
                    oninput={(e) => npcs.updateStat(n.id, s.id, { key: e.currentTarget.value })}
                    placeholder="Key (HP, AC…)"
                  />
                  <input
                    class="in"
                    value={s.val}
                    oninput={(e) => npcs.updateStat(n.id, s.id, { val: e.currentTarget.value })}
                    placeholder="Value"
                  />
                  <button class="mini" aria-label="Remove stat" onclick={() => npcs.removeStat(n.id, s.id)}>×</button>
                </div>
              {/each}
            </section>

            <!-- Public blurb -->
            <section>
              <div class="seclabel public">Public blurb · players may see</div>
              <textarea
                class="in ta"
                value={n.publicBlurb ?? ''}
                oninput={(e) => npcs.update(n.id, { publicBlurb: e.currentTarget.value })}
                placeholder="What players are allowed to learn about this NPC…"
              ></textarea>
            </section>

            <!-- GM notes -->
            <section>
              <div class="seclabel private">GM notes · private, never broadcast</div>
              <textarea
                class="in ta"
                value={n.gmNotes ?? ''}
                oninput={(e) => npcs.update(n.id, { gmNotes: e.currentTarget.value })}
                placeholder="Secrets, plot hooks, true motives — GM eyes only…"
              ></textarea>
            </section>
          </div>
        {/if}
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
    align-items: start;
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

  /* --- detail panel ------------------------------------------------------ */
  .detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .detail section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seclabel {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .seclabel.public {
    color: var(--green);
  }
  .seclabel.private {
    color: #d98c7a;
  }
  .mini {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .mini:hover {
    background: rgba(47, 138, 102, 0.18);
  }

  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .thumb {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--line2);
  }
  .thumb.primary {
    border-color: var(--green);
    box-shadow: 0 0 0 1px var(--green);
  }
  .thumbpick {
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .thumbpick img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumbx {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 0;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
  }
  .addthumb {
    display: grid;
    place-items: center;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.25);
    color: var(--green);
    font-size: 20px;
  }

  .equiprow,
  .statrow {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .in.qty {
    width: 64px;
    flex: 0 0 auto;
  }
  .ta {
    min-height: 60px;
    resize: vertical;
    line-height: 1.4;
  }
</style>
