<script lang="ts">
  import { onMount } from 'svelte';
  import { composer } from './store.svelte';
  import { npcs } from '../npcs/store.svelte';
  import { assetPut, assetUrl } from '../../lib/db';
  import { putOnAir } from '../reveal/bus-actions';
  import { clampCols, gridAssetIds } from '../../broadcast/grid';
  import type { GraphNode } from './graph';
  import type { GridCell } from '../../lib/types';

  const NODE_W = 168;
  const HEADER_H = 24;
  const SLOT_GAP = 22;
  const SLOT_TOP = 40;

  onMount(() => {
    void composer.load();
    void npcs.load();
  });

  let canvas = $state<HTMLDivElement | null>(null);

  // Node drag state
  let dragging = $state<string | null>(null);
  let offX = 0;
  let offY = 0;

  // Wire-drag state: from a source output port to a grid slot
  let wiring = $state<{ from: string; x: number; y: number } | null>(null);

  function canvasXY(e: PointerEvent): { x: number; y: number } {
    const r = canvas?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  // --- node header drag ----------------------------------------------------
  function startDrag(e: PointerEvent, n: GraphNode) {
    dragging = n.id;
    const { x, y } = canvasXY(e);
    offX = x - n.x;
    offY = y - n.y;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    const { x, y } = canvasXY(e);
    if (dragging) {
      const r = canvas?.getBoundingClientRect();
      const maxX = Math.max(0, (r?.width ?? 0) - NODE_W);
      const maxY = Math.max(0, (r?.height ?? 0) - HEADER_H);
      composer.move(dragging, clamp(x - offX, 0, maxX), clamp(y - offY, 0, maxY));
    }
    if (wiring) wiring = { ...wiring, x, y };
  }
  function endDrag(e: PointerEvent) {
    if (dragging) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragging = null;
  }
  function clamp(v: number, lo: number, hi: number) {
    return Math.min(Math.max(v, lo), hi);
  }

  // --- port geometry -------------------------------------------------------
  function outPort(n: GraphNode) {
    return { x: n.x + NODE_W, y: n.y + HEADER_H / 2 };
  }
  function slotPort(grid: GraphNode, slot: number) {
    return { x: grid.x, y: grid.y + SLOT_TOP + slot * SLOT_GAP + 6 };
  }

  // How many input slots the grid shows: at least 2, or one past the
  // highest used slot, plus any manually added via ＋Slot.
  let extraSlots = $state(0);
  let slotCount = $derived.by(() => {
    const used = composer.edges.reduce((m, e) => Math.max(m, e.toSlot + 1), 0);
    return Math.max(2, used) + extraSlots;
  });
  function slots(): number[] {
    return Array.from({ length: slotCount }, (_, i) => i);
  }

  // --- wiring --------------------------------------------------------------
  function startWire(e: PointerEvent, from: string) {
    e.stopPropagation();
    const { x, y } = canvasXY(e);
    wiring = { from, x, y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function dropOnSlot(e: PointerEvent, slot: number) {
    if (!wiring) return;
    e.stopPropagation();
    const grid = composer.gridNode;
    if (grid) composer.connect(wiring.from, grid.id, slot);
    wiring = null;
  }
  function endWire() {
    wiring = null;
  }

  function edgeGeom(fromId: string, toSlot: number) {
    const src = composer.nodes.find((n) => n.id === fromId);
    const grid = composer.gridNode;
    if (!src || !grid) return null;
    const a = outPort(src);
    const b = slotPort(grid, toSlot);
    return `M ${a.x} ${a.y} C ${a.x + 50} ${a.y}, ${b.x - 50} ${b.y}, ${b.x} ${b.y}`;
  }

  // --- node body actions ---------------------------------------------------
  async function pickImage(e: Event, id: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const assetId = await assetPut(file, file.type || 'image/png');
    composer.patch(id, { assetId });
  }

  function npcPreview(n: GraphNode): string {
    if (!n.npcId) return '—';
    const pub = composer.npcLookup(n.npcId);
    if (!pub) return '—';
    return pub.role ? `${pub.name} · ${pub.role}` : pub.name;
  }

  // --- live preview --------------------------------------------------------
  let preview = $derived(composer.preview);

  // Resolve preview image cells' asset ids to tab-local object URLs (revoked on
  // change / unmount), mirroring the broadcast renderer.
  let previewUrls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set(preview ? gridAssetIds(preview.cells) : []);
    for (const [id, url] of Object.entries(previewUrls)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete previewUrls[id];
      }
    }
    for (const id of want) {
      if (!previewUrls[id]) {
        void assetUrl(id).then((u) => {
          if (u) previewUrls[id] = u;
        });
      }
    }
  });
  $effect(() => () => {
    for (const url of Object.values(previewUrls)) URL.revokeObjectURL(url);
  });

  function cellImg(cell: GridCell): string | undefined {
    if (cell.kind !== 'image') return undefined;
    return cell.assetId ? previewUrls[cell.assetId] : cell.src;
  }

  function onAir() {
    const payload = composer.preview;
    if (payload) putOnAir(payload);
  }

  const TITLES: Record<string, string> = {
    npc: 'NPC',
    image: 'Image',
    text: 'Text',
    grid: 'Grid (sink)',
  };
</script>

<div class="cbar">
  <button class="btn sm" onclick={() => composer.add('npc', 40, 40)}>＋ NPC</button>
  <button class="btn sm" onclick={() => composer.add('image', 40, 120)}>＋ Image</button>
  <button class="btn sm" onclick={() => composer.add('text', 40, 200)}>＋ Text</button>
  <button class="btn sm" onclick={() => extraSlots++}>＋ Slot</button>
  <button class="btn sm air" onclick={onAir} disabled={!preview}>On Air</button>
</div>

<div
  class="cgraph"
  bind:this={canvas}
  data-no-drag
  role="application"
  aria-label="Node graph canvas"
  onpointermove={onMove}
  onpointerup={endWire}
>
  <svg class="wires">
    {#each composer.edges as e (e.id)}
      {@const d = edgeGeom(e.from, e.toSlot)}
      {#if d}
        <path class="wire-hit" {d} onpointerdown={() => composer.disconnect(e.id)} role="presentation" />
        <path class="wire" {d} />
      {/if}
    {/each}
    {#if wiring}
      {@const src = composer.nodes.find((n) => n.id === wiring!.from)}
      {#if src}
        {@const a = outPort(src)}
        <path class="wire live" d={`M ${a.x} ${a.y} L ${wiring.x} ${wiring.y}`} />
      {/if}
    {/if}
  </svg>

  {#each composer.nodes as n (n.id)}
    <div class="node" class:sink={n.kind === 'grid'} style="left:{n.x}px; top:{n.y}px; width:{NODE_W}px;">
      <div
        class="nhead"
        onpointerdown={(e) => startDrag(e, n)}
        onpointerup={endDrag}
        role="button"
        tabindex="0"
      >
        <span class="ntitle">{TITLES[n.kind]}</span>
        {#if n.kind !== 'grid'}
          <button class="nx" onpointerdown={(e) => e.stopPropagation()} onclick={() => composer.remove(n.id)} aria-label="Remove node">✕</button>
        {/if}
      </div>

      <div class="nbody" data-no-drag>
        {#if n.kind === 'npc'}
          <select
            value={n.npcId ?? ''}
            onchange={(e) => composer.patch(n.id, { npcId: (e.currentTarget as HTMLSelectElement).value || undefined })}
            aria-label="NPC"
          >
            <option value="">— pick NPC —</option>
            {#each npcs.list as npc (npc.id)}
              <option value={npc.id}>{npc.name}</option>
            {/each}
          </select>
          <div class="prev">{npcPreview(n)}</div>
        {:else if n.kind === 'image'}
          <input
            type="url"
            placeholder="image URL"
            value={n.src ?? ''}
            oninput={(e) => composer.patch(n.id, { src: (e.currentTarget as HTMLInputElement).value || undefined })}
            aria-label="Image URL"
          />
          <input type="file" accept="image/*" onchange={(e) => pickImage(e, n.id)} aria-label="Upload image" />
          <input
            type="text"
            placeholder="caption"
            value={n.caption ?? ''}
            oninput={(e) => composer.patch(n.id, { caption: (e.currentTarget as HTMLInputElement).value || undefined })}
            aria-label="Caption"
          />
        {:else if n.kind === 'text'}
          <input
            type="text"
            placeholder="title"
            value={n.title ?? ''}
            oninput={(e) => composer.patch(n.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })}
            aria-label="Title"
          />
          <textarea
            placeholder="body"
            value={n.body ?? ''}
            oninput={(e) => composer.patch(n.id, { body: (e.currentTarget as HTMLTextAreaElement).value || undefined })}
            aria-label="Body"
          ></textarea>
        {:else if n.kind === 'grid'}
          <label class="cols">
            cols
            <input
              type="number"
              min="1"
              max="6"
              value={n.cols ?? 2}
              oninput={(e) => composer.patch(n.id, { cols: Number((e.currentTarget as HTMLInputElement).value) })}
              aria-label="Columns"
            />
          </label>
          <div class="slotlist">
            {#each slots() as s (s)}
              <div class="slotrow">
                <span
                  class="port in"
                  onpointerup={(e) => dropOnSlot(e, s)}
                  role="button"
                  tabindex="0"
                  aria-label={`Slot ${s}`}
                ></span>
                <span class="slotlbl">slot {s}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if n.kind !== 'grid'}
        <span
          class="port out"
          onpointerdown={(e) => startWire(e, n.id)}
          role="button"
          tabindex="0"
          aria-label="Output port"
        ></span>
      {/if}
    </div>
  {/each}
</div>

<div class="pvwrap" data-no-drag>
  <span class="pvlbl">Live preview</span>
  {#if preview}
    <div class="pvgrid" style="grid-template-columns: repeat({clampCols(preview.cols, preview.cells.length)}, 1fr)">
      {#each preview.cells as cell, i (i)}
        <div class="pvcell">
          {#if cell.kind === 'image'}
            {@const url = cellImg(cell)}
            {#if url}
              <img src={url} alt={cell.caption ?? ''} />
            {/if}
            {#if cell.caption}<span class="pvcap">{cell.caption}</span>{/if}
          {:else}
            {#if cell.title}<strong>{cell.title}</strong>{/if}
            {#if cell.body}<span>{cell.body}</span>{/if}
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="pvempty">Wire a source into the grid to preview.</div>
  {/if}
</div>

<style>
  .cbar {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .cbar .btn.sm {
    padding: 5px 9px;
    font-size: 12px;
  }
  .cbar .btn.air {
    margin-left: auto;
    border-color: var(--gold, #c7a44e);
    color: var(--gold, #c7a44e);
  }
  .cbar .btn.air:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pvwrap {
    margin-top: 6px;
  }
  .pvlbl {
    display: block;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted, #9a9484);
    margin-bottom: 4px;
  }
  .pvgrid {
    display: grid;
    gap: 4px;
  }
  .pvcell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px;
    font-size: 10px;
    border: 1px solid var(--line2);
    border-radius: 4px;
    background: rgba(20, 28, 22, 0.4);
    color: var(--ink, #e7e3d4);
  }
  .pvcell img {
    width: 100%;
    height: 48px;
    object-fit: cover;
    border-radius: 3px;
  }
  .pvcap {
    color: var(--muted, #9a9484);
  }
  .pvempty {
    font-size: 11px;
    color: var(--faint, #6f6a5c);
    font-style: italic;
  }
  .cgraph {
    position: relative;
    flex: 1;
    min-height: 220px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(20, 28, 22, 0.4);
    overflow: hidden;
    touch-action: none;
  }
  .wires {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .wire {
    fill: none;
    stroke: var(--gold, #c7a44e);
    stroke-width: 2;
  }
  .wire.live {
    stroke-dasharray: 4 3;
    opacity: 0.8;
  }
  .wire-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 12;
    pointer-events: stroke;
    cursor: pointer;
  }
  .node {
    position: absolute;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: #1d2620;
    color: var(--ink, #e7e3d4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
    font-size: 11px;
  }
  .node.sink {
    border-color: var(--gold, #c7a44e);
  }
  .nhead {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 6px;
    background: rgba(199, 164, 78, 0.16);
    border-bottom: 1px solid var(--line2);
    cursor: grab;
    border-radius: 6px 6px 0 0;
    user-select: none;
  }
  .ntitle {
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .nx {
    margin-left: auto;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
  }
  .nx:hover {
    background: #8a3b34;
    color: #fff;
  }
  .nbody {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px;
  }
  .nbody input,
  .nbody select,
  .nbody textarea {
    width: 100%;
    box-sizing: border-box;
    font-size: 11px;
    padding: 3px 4px;
    background: #11160f;
    color: var(--ink, #e7e3d4);
    border: 1px solid var(--line2);
    border-radius: 3px;
  }
  .nbody textarea {
    min-height: 38px;
    resize: vertical;
  }
  .prev {
    color: var(--muted, #9a9484);
    font-style: italic;
  }
  .cols {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cols input {
    width: 48px;
  }
  .slotlist {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 2px;
  }
  .slotrow {
    display: flex;
    align-items: center;
    gap: 6px;
    position: relative;
  }
  .slotlbl {
    color: var(--muted, #9a9484);
  }
  .port {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gold, #c7a44e);
    border: 2px solid #11160f;
    cursor: crosshair;
  }
  .port.out {
    right: -7px;
    top: 6px;
  }
  .port.in {
    position: static;
    margin-left: -13px;
    cursor: pointer;
  }
</style>
