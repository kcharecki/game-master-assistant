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

  // Grid input slots: follow the column count, never fewer than the highest
  // wired slot, plus any added manually via ＋Slot.
  let extraSlots = $state(0);
  let slotCount = $derived.by(() => {
    const cols = composer.gridNode?.cols ?? 2;
    const used = composer.edges.reduce((m, e) => Math.max(m, e.toSlot + 1), 0);
    return Math.max(cols, used, 1) + extraSlots;
  });
  function slots(): number[] {
    return Array.from({ length: slotCount }, (_, i) => i);
  }

  // --- port positions (measured from the DOM) ------------------------------
  // Wires must land exactly on the rendered port dots no matter how tall a
  // node's body is, so measure real element rects instead of guessing from
  // constants — the constants drifted as node content changed and wires ended
  // up near the wrong row.
  const portEls = new Map<string, HTMLElement>();
  let ports = $state<Record<string, { x: number; y: number }>>({});

  function registerPort(el: HTMLElement, key: string) {
    portEls.set(key, el);
    measurePorts();
    return { destroy: () => void portEls.delete(key) };
  }
  function measurePorts() {
    const r = canvas?.getBoundingClientRect();
    if (!r) return;
    const next: Record<string, { x: number; y: number }> = {};
    for (const [k, el] of portEls) {
      const b = el.getBoundingClientRect();
      next[k] = { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
    }
    ports = next;
  }
  // Re-measure after any layout-affecting change (node moved/added, slots/cols
  // changed), once the DOM has painted.
  $effect(() => {
    composer.nodes.map((n) => `${n.x},${n.y}`); // touch positions
    void slotCount; // touch slot count
    requestAnimationFrame(measurePorts);
  });
  // Keep wires aligned when the window/canvas resizes.
  $effect(() => {
    if (!canvas) return;
    const ro = new ResizeObserver(() => measurePorts());
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  // --- wiring --------------------------------------------------------------
  function startWire(e: PointerEvent, from: string) {
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = canvasXY(e);
    wiring = { from, x, y };
    // NOTE: do NOT setPointerCapture here — capture would redirect the pointerup
    // to this output port, so the target slot's onpointerup (dropOnSlot) would
    // never fire and no edge could be made. Canvas onpointermove tracks the wire.
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
    const a = ports[`out:${fromId}`];
    const b = ports[`in:${toSlot}`];
    if (!a || !b) return null;
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

  // Resolve each NPC node's portrait (asset id -> tab-local object URL) so the
  // node shows a small thumbnail. Same asset-id rule + revoke discipline.
  let npcThumbs = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    for (const n of composer.nodes) {
      if (n.kind === 'npc' && n.npcId) {
        const pub = composer.npcLookup(n.npcId);
        if (pub?.portraitId) want.add(pub.portraitId);
      }
    }
    for (const [id, url] of Object.entries(npcThumbs)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete npcThumbs[id];
      }
    }
    for (const id of want) {
      if (!npcThumbs[id]) {
        void assetUrl(id).then((u) => {
          if (u) npcThumbs[id] = u;
        });
      }
    }
  });
  $effect(() => () => {
    for (const url of Object.values(npcThumbs)) URL.revokeObjectURL(url);
  });
  function npcThumb(n: GraphNode): string | undefined {
    if (!n.npcId) return undefined;
    const pub = composer.npcLookup(n.npcId);
    return pub?.portraitId ? npcThumbs[pub.portraitId] : undefined;
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

  // --- tab strip (views) ---------------------------------------------------
  let editingId = $state<string | null>(null);
  function startRename(id: string) {
    editingId = id;
  }
  function commitRename(id: string, value: string) {
    const name = value.trim();
    if (name) composer.renameView(id, name);
    editingId = null;
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
  <button class="btn sm air" onclick={onAir} disabled={!preview}>Broadcast</button>
</div>

<div class="tabstrip" role="tablist" aria-label="Composer views">
  {#each composer.views as v (v.id)}
    <div class="tab" class:active={v.id === composer.activeId}>
      {#if editingId === v.id}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="tabedit"
          value={v.name}
          autofocus
          onblur={(e) => commitRename(v.id, (e.currentTarget as HTMLInputElement).value)}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            else if (e.key === 'Escape') (editingId = null);
          }}
          aria-label="View name"
        />
      {:else}
        <button
          class="tablabel"
          role="tab"
          aria-selected={v.id === composer.activeId}
          onclick={() => composer.setActive(v.id)}
          ondblclick={() => startRename(v.id)}
        >{v.name}</button>
        <button
          class="tabx"
          onclick={() => composer.removeView(v.id)}
          disabled={composer.views.length <= 1}
          aria-label={`Close ${v.name}`}
          title="Close view"
        >✕</button>
      {/if}
    </div>
  {/each}
  <button class="tabadd" onclick={() => composer.addView()} aria-label="Add view" title="Add view">＋</button>
  <button class="tabadd" onclick={() => composer.duplicateView()} aria-label="Duplicate view" title="Duplicate view">⧉</button>
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
      {@const a = ports[`out:${wiring.from}`]}
      {#if a}
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
          {@const thumb = npcThumb(n)}
          <div class="npcrow">
            {#if thumb}
              <img class="npcthumb" src={thumb} alt="" onload={measurePorts} />
            {/if}
            <div class="prev">{npcPreview(n)}</div>
          </div>
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
              <div
                class="slotrow"
                class:wirable={wiring}
                onpointerup={(e) => dropOnSlot(e, s)}
                role="button"
                tabindex="0"
                aria-label={`Slot ${s}`}
              >
                <span class="port in" use:registerPort={`in:${s}`}></span>
                <span class="slotlbl">slot {s}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if n.kind !== 'grid'}
        <span
          class="port out"
          use:registerPort={`out:${n.id}`}
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
  .tabstrip {
    display: flex;
    align-items: stretch;
    gap: 4px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .tab {
    display: flex;
    align-items: center;
    border: 1px solid var(--line2);
    border-radius: 6px 6px 0 0;
    background: rgba(20, 28, 22, 0.5);
    overflow: hidden;
  }
  .tab.active {
    border-color: var(--gold, #c7a44e);
    background: rgba(199, 164, 78, 0.16);
  }
  .tablabel {
    padding: 4px 9px;
    font-size: 12px;
    border: 0;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab.active .tablabel {
    color: var(--ink, #e7e3d4);
    font-weight: 600;
  }
  .tabx {
    width: 18px;
    height: 18px;
    margin-right: 3px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
    font-size: 10px;
  }
  .tabx:hover:not(:disabled) {
    background: #8a3b34;
    color: #fff;
  }
  .tabx:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .tabedit {
    width: 110px;
    margin: 2px;
    padding: 2px 5px;
    font-size: 12px;
    background: #11160f;
    color: var(--ink, #e7e3d4);
    border: 1px solid var(--gold, #c7a44e);
    border-radius: 4px;
  }
  .tabadd {
    width: 26px;
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.5);
    color: var(--gold, #c7a44e);
    cursor: pointer;
    font-size: 13px;
  }
  .tabadd:hover {
    background: rgba(199, 164, 78, 0.18);
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
    gap: 8px;
  }
  .pvcell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    font-size: 12px;
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.4);
    color: var(--ink, #e7e3d4);
  }
  .pvcell img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border-radius: 4px;
  }
  .pvcell strong {
    font-size: 14px;
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
  .npcrow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .npcthumb {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid var(--line2);
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
    border-radius: 4px;
  }
  /* While dragging a wire, slots are valid drop targets — make that obvious. */
  .slotrow.wirable {
    cursor: pointer;
  }
  .slotrow.wirable:hover {
    background: rgba(199, 164, 78, 0.18);
    outline: 1px dashed var(--gold, #c7a44e);
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
