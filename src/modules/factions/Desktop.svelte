<script lang="ts">
  import { onMount } from 'svelte';
  import { factions } from './store.svelte';
  import { circleLayout, edgeGeometry, RELATION_COLOR, type RelationType } from './graph';
  import { t } from '../../lib/i18n';

  onMount(() => void factions.load());

  const W = 280;
  const H = 240;
  const positions = $derived(circleLayout(factions.factions.map((f) => f.id), W / 2, H / 2 - 6, 84));
  const nameOf = (id: string) => factions.factions.find((f) => f.id === id)?.name ?? '?';

  const types: RelationType[] = ['hates', 'owes', 'serves', 'allied'];
  let relFrom = $state('');
  let relTo = $state('');
  let relType = $state<RelationType>('allied');

  function addRel() {
    if (relFrom && relTo) factions.addRelationship(relFrom, relTo, relType);
  }
</script>

<div class="fac">
  <svg viewBox="0 0 {W} {H}" class="web" role="img" aria-label={t('factions.web')}>
    {#each factions.relationships as r, i (i)}
      {@const g = edgeGeometry(r, positions)}
      {#if g}
        <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke={g.color} stroke-width="1.6" opacity="0.8" />
        <text x={g.mid.x} y={g.mid.y} class="elabel" fill={g.color}>{t('factions.rel.' + r.type)}</text>
      {/if}
    {/each}
    {#each positions as p (p.id)}
      <g>
        <circle cx={p.x} cy={p.y} r="9" class="node" />
        <text x={p.x} y={p.y - 13} class="nlabel">{nameOf(p.id)}</text>
      </g>
    {/each}
  </svg>

  <div class="controls">
    <div class="row">
      <button class="btn sm" onclick={() => factions.addFaction()}>{t('factions.addFaction')}</button>
    </div>
    <div class="row rel">
      <select bind:value={relFrom}>
        <option value="" disabled>{t('factions.from')}</option>
        {#each factions.factions as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
      </select>
      <select bind:value={relType}>
        {#each types as rt (rt)}<option value={rt}>{t('factions.rel.' + rt)}</option>{/each}
      </select>
      <select bind:value={relTo}>
        <option value="" disabled>{t('factions.to')}</option>
        {#each factions.factions as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
      </select>
      <button class="btn sm" onclick={addRel}>{t('factions.link')}</button>
    </div>
    <div class="legend">
      {#each types as rt (rt)}
        <span class="key"><span class="sw" style="background:{RELATION_COLOR[rt]}"></span>{t('factions.rel.' + rt)}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .fac {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    gap: 8px;
  }
  .web {
    width: 100%;
    flex: 0 0 auto;
  }
  .node {
    fill: var(--panel2);
    stroke: var(--green);
    stroke-width: 1.5;
  }
  .nlabel {
    fill: var(--txt);
    font-size: 9px;
    text-anchor: middle;
    font-family: Georgia, serif;
  }
  .elabel {
    font-size: 8px;
    text-anchor: middle;
    opacity: 0.85;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .rel select {
    flex: 1;
    min-width: 0;
    padding: 4px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 11px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    color: var(--muted);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .sw {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }
</style>
