<script lang="ts">
  import { npcs, type Disposition } from './store.svelte';

  const dispositions: Disposition[] = ['ally', 'neutral', 'hostile'];
</script>

<div class="editor">
  <header class="ehead">
    <h2>NPC Roster</h2>
    <button class="btn solid" onclick={() => npcs.add()}>＋ New NPC</button>
  </header>

  <div class="grid">
    {#each npcs.list as n (n.id)}
      <div class="card">
        <input
          class="in name"
          value={n.name}
          oninput={(e) => npcs.update(n.id, { name: e.currentTarget.value })}
          placeholder="Name"
        />
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
    margin-bottom: 18px;
  }
  .ehead h2 {
    font-family: Georgia, serif;
    font-size: 22px;
    color: #e9f3ed;
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
</style>
