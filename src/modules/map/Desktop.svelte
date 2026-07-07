<script lang="ts">
  import { onMount } from 'svelte';
  import { map, GRID_SIZE, snapToCell, normPing, type Token } from './store.svelte';
  import { broadcastMap, broadcastPing } from './bus-actions';
  import { assetPut, assetUrl } from '../../lib/db';
  import { conditionsFor, conditionMeta, conditionGlyph } from './conditions';
  import { system } from '../../lib/stores/system.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';

  // States the GM can toggle per token, switching with the active game system.
  const conditionCatalog = $derived(conditionsFor(system.current));
  let statesOpen = $state(false);

  // Visible canvas size (px), bound on the wrapper below. Lets us size the grid
  // overlay to just the viewport instead of a giant fixed rect — a big perf win,
  // since a huge patterned rect re-rasterises thousands of tiles on every
  // pan/zoom/measure frame.
  let vw = $state(0);
  let vh = $state(0);
  const gridRect = $derived.by(() => {
    const { panX, panY, zoom } = map.transform;
    const G = GRID_SIZE;
    const m = G * 2; // margin so lines cover the edges while panning
    const x = Math.floor(-panX / zoom / G) * G - m;
    const y = Math.floor(-panY / zoom / G) * G - m;
    return { x, y, w: vw / zoom + m * 2, h: vh / zoom + m * 2 };
  });

  let selected = $state<string | null>(null);
  let dragId: string | null = null;
  let panning = false;
  let lastX = 0;
  let lastY = 0;
  // Tool: 'off' = normal drag/pan; 'reveal'/'hide' paint single fog cells;
  // 'region' = marquee-select a rectangle to reveal; 'ruler' = calibrate scale;
  // 'ping' flashes a marker.
  let fogTool = $state<
    'off' | 'reveal' | 'hide' | 'region' | 'ruler' | 'gridcal' | 'frame' | 'ping' | 'measure' | 'draw'
  >('off');

  // Measure overlay (GM-side): a line whose length reads in metres, optionally
  // shown as a circle (burst) or cone (60°) AoE template. Never broadcast.
  let measure = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  let measureShape = $state<'line' | 'circle' | 'cone'>('line');
  const measureLenM = $derived(
    measure ? Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1) / GRID_SIZE : 0
  );

  // GM-only freehand drawing layer (annotations, traps, walls). Never broadcast.
  let strokes = $state<{ pts: { x: number; y: number }[] }[]>([]);
  let curStroke = $state<{ x: number; y: number }[] | null>(null);
  function persistDraw() {
    void kvSetDraw();
  }
  async function kvSetDraw() {
    const { kvSet } = await import('../../lib/db');
    await kvSet('mapDraw', $state.snapshot(strokes));
  }
  function strokePath(pts: { x: number; y: number }[]): string {
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  // Marquee (region reveal) rect in fog-cell indices while dragging.
  let region = $state<{ c0: number; r0: number; c1: number; r1: number } | null>(null);
  // Ruler line in world (map) px; kept after release until the GM enters metres.
  let ruler = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  let rulerMeters = $state('5');

  // Grid-sync box in world px; kept after release until the GM enters its size.
  let gridBox = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  let gcCols = $state('2');
  let gcRows = $state('2');

  // Broadcast-frame box (world px) while dragging the Frame tool.
  let frameBox = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Map library panel.
  let libraryOpen = $state(false);
  let savedMaps = $state<import('./store.svelte').SavedMap[]>([]);
  let mapName = $state('');
  async function refreshMaps() {
    savedMaps = await map.listMaps();
  }
  async function saveCurrentMap() {
    await map.saveMap(mapName || `Map ${savedMaps.length + 1}`);
    mapName = '';
    await refreshMaps();
  }
  async function loadSavedMap(id: string) {
    await map.loadMap(id);
  }
  async function deleteSavedMap(id: string) {
    await map.deleteMap(id);
    await refreshMaps();
  }
  const GRID_LABEL = { square: 'map.gridSquare', hex: 'map.gridHex', none: 'map.gridNone' } as const;

  // Background image -> tab-local object URL (revoked on change/unmount).
  let bgUrl = $state('');
  $effect(() => {
    const id = map.bg?.assetId;
    if (!id) {
      bgUrl = '';
      return;
    }
    let url = '';
    void assetUrl(id).then((u) => {
      if (u) {
        url = u;
        bgUrl = u;
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  onMount(() => {
    void map.load();
    void (async () => {
      const { kvGet } = await import('../../lib/db');
      const saved = await kvGet<{ pts: { x: number; y: number }[] }[]>('mapDraw');
      if (saved?.length) strokes = saved;
    })();
  });

  // Convert a client-space pointer to map-cell coordinates given current transform.
  function toCell(svg: SVGSVGElement, clientX: number, clientY: number) {
    const r = svg.getBoundingClientRect();
    const { panX, panY, zoom } = map.transform;
    const px = (clientX - r.left - panX) / zoom;
    const py = (clientY - r.top - panY) / zoom;
    return { gx: snapToCell(px), gy: snapToCell(py) };
  }

  // Client-space pointer -> world (map, pre-zoom) px. Used by the ruler.
  function toWorld(svg: SVGSVGElement, clientX: number, clientY: number) {
    const r = svg.getBoundingClientRect();
    const { panX, panY, zoom } = map.transform;
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom };
  }

  async function pickBg(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const probe = URL.createObjectURL(file);
    try {
      const dim = await new Promise<{ w: number; h: number }>((res, rej) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = rej;
        im.src = probe;
      });
      const assetId = await assetPut(file, file.type || 'image/png');
      map.setBg(assetId, dim.w, dim.h);
    } finally {
      URL.revokeObjectURL(probe);
      input.value = '';
    }
  }

  function applyRuler() {
    if (!ruler) return;
    const len = Math.hypot(ruler.x2 - ruler.x1, ruler.y2 - ruler.y1);
    const m = Number(rulerMeters);
    if (len > 0 && m > 0) map.calibrate(len, m);
    ruler = null;
    fogTool = 'off';
  }

  // Live length of the ruler line in metres (1 cell = 1 m at current scale).
  const rulerLenM = $derived(
    ruler ? Math.hypot(ruler.x2 - ruler.x1, ruler.y2 - ruler.y1) / GRID_SIZE : 0
  );

  function applyGridcal() {
    if (!gridBox) return;
    const cols = Number(gcCols);
    const rows = Number(gcRows);
    if (cols > 0 && rows > 0) map.calibrateBox(gridBox, cols, rows);
    gridBox = null;
    fogTool = 'off';
  }

  function onTokenDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragId = id;
    selected = id;
  }

  // Pointer -> fog cell index (floor, since fog cells are area-based).
  function toFogCell(svg: SVGSVGElement, clientX: number, clientY: number) {
    const r = svg.getBoundingClientRect();
    const { panX, panY, zoom } = map.transform;
    const col = Math.floor((clientX - r.left - panX) / zoom / GRID_SIZE);
    const row = Math.floor((clientY - r.top - panY) / zoom / GRID_SIZE);
    return { col, row };
  }

  function paintAt(svg: SVGSVGElement, clientX: number, clientY: number) {
    const { col, row } = toFogCell(svg, clientX, clientY);
    map.setFog(col, row, fogTool === 'reveal');
  }

  function onMove(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    if ((fogTool === 'reveal' || fogTool === 'hide') && panning) {
      paintAt(svg, e.clientX, e.clientY);
    } else if (fogTool === 'region' && region) {
      const { col, row } = toFogCell(svg, e.clientX, e.clientY);
      region = { ...region, c1: col, r1: row };
    } else if (fogTool === 'ruler' && ruler && panning) {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      ruler = { ...ruler, x2: x, y2: y };
    } else if (fogTool === 'gridcal' && gridBox && panning) {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      gridBox = { ...gridBox, x2: x, y2: y };
    } else if (fogTool === 'frame' && frameBox && panning) {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      frameBox = { ...frameBox, x2: x, y2: y };
    } else if (fogTool === 'measure' && measure && panning) {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      measure = { ...measure, x2: x, y2: y };
    } else if (fogTool === 'draw' && curStroke && panning) {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      curStroke = [...curStroke, { x, y }];
    } else if (dragId) {
      const { gx, gy } = toCell(svg, e.clientX, e.clientY);
      map.setTokenPos(dragId, gx, gy);
    } else if (panning) {
      map.pan(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function onCanvasDown(e: PointerEvent) {
    panning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    selected = null;
    const svg = e.currentTarget as SVGSVGElement;
    if (fogTool === 'reveal' || fogTool === 'hide') {
      paintAt(svg, e.clientX, e.clientY);
    } else if (fogTool === 'region') {
      const { col, row } = toFogCell(svg, e.clientX, e.clientY);
      region = { c0: col, r0: row, c1: col, r1: row };
    } else if (fogTool === 'ruler') {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      ruler = { x1: x, y1: y, x2: x, y2: y };
    } else if (fogTool === 'gridcal') {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      gridBox = { x1: x, y1: y, x2: x, y2: y };
    } else if (fogTool === 'frame') {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      frameBox = { x1: x, y1: y, x2: x, y2: y };
    } else if (fogTool === 'measure') {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      measure = { x1: x, y1: y, x2: x, y2: y };
    } else if (fogTool === 'draw') {
      const { x, y } = toWorld(svg, e.clientX, e.clientY);
      curStroke = [{ x, y }];
    } else if (fogTool === 'ping') {
      const { x, y } = normPing(e.clientX, e.clientY, svg.getBoundingClientRect());
      broadcastPing(x, y);
    }
  }

  function putMapOnAir() {
    // Only player-safe token fields cross to the broadcast (no HP/conditions).
    const tokens = map.tokens.map((tk) => ({
      gx: tk.gx,
      gy: tk.gy,
      label: tk.label,
      color: tk.color,
      conditions: [...tk.conditions],
      size: tk.size ?? 1,
    }));
    const bg = map.bg;
    broadcastMap(map.fogPayload(), {
      assetId: bg?.assetId,
      grid: map.gridMode,
      tokens,
      img: bg ? { x: bg.dx, y: bg.dy, w: bg.w * bg.scale, h: bg.h * bg.scale } : undefined,
      view: map.broadcastView(),
    });
  }

  function onUp() {
    // Commit a region-reveal marquee on release.
    if (fogTool === 'region' && region) {
      map.setFogRect(region.c0, region.r0, region.c1, region.r1, true);
      region = null;
    }
    // Commit a broadcast frame on release.
    if (fogTool === 'frame' && frameBox) {
      map.setView(frameBox.x1, frameBox.y1, frameBox.x2, frameBox.y2);
      frameBox = null;
    }
    // Commit a freehand annotation stroke on release.
    if (fogTool === 'draw' && curStroke) {
      if (curStroke.length > 1) strokes = [...strokes, { pts: curStroke }];
      curStroke = null;
      persistDraw();
    }
    // Persist a token drag once, on drop (moves were in-memory during the drag).
    if (dragId) map.persist();
    // Persist brush-painted fog once, on release.
    if (fogTool === 'reveal' || fogTool === 'hide') map.persistFog();
    dragId = null;
    panning = false;
  }

  function clearDrawings() {
    strokes = [];
    persistDraw();
  }
  function undoDrawing() {
    strokes = strokes.slice(0, -1);
    persistDraw();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    map.zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
  }

  const sel = $derived(map.tokens.find((t) => t.id === selected) ?? null);
  // Collapse the state picker whenever the selected token changes.
  $effect(() => {
    void selected;
    statesOpen = false;
  });
  function damage(t: Token, n: number) {
    map.setHp(t.id, t.hp + n);
  }
</script>

<div class="map-wrap" data-no-drag bind:clientWidth={vw} bind:clientHeight={vh}>
  <!-- Background image on its own GPU-composited layer, transformed by the same
       pan/zoom as the SVG. Keeping the (large, scaled) bitmap out of the overlay
       SVG means measuring/drawing/dragging never re-rasterises it. -->
  {#if bgUrl && map.bg}
    <div
      class="bg-layer"
      style="transform:translate({map.transform.panX}px,{map.transform.panY}px) scale({map.transform.zoom})"
    >
      <img
        class="bg-img"
        src={bgUrl}
        alt=""
        style="left:{map.bg.dx}px;top:{map.bg.dy}px;width:{map.bg.w * map.bg.scale}px;height:{map.bg.h * map.bg.scale}px"
      />
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    class="canvas"
    aria-label={t('map.canvas')}
    onpointerdown={onCanvasDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointerleave={onUp}
    onwheel={onWheel}
  >
    <g transform="translate({map.transform.panX} {map.transform.panY}) scale({map.transform.zoom})">
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path
            d="M {GRID_SIZE} 0 L 0 0 0 {GRID_SIZE}"
            fill="none"
            stroke="var(--line1)"
            stroke-width="1"
          />
        </pattern>
      </defs>
      <rect x={gridRect.x} y={gridRect.y} width={gridRect.w} height={gridRect.h} fill="url(#grid)" />

      <!-- Fog: hidden cells dimmed on the GM view (players see them opaque). -->
      {#each map.fog as fogRow, row (row)}
        {#each fogRow as revealed, col (col)}
          {#if !revealed}
            <rect
              class="fog"
              x={col * GRID_SIZE}
              y={row * GRID_SIZE}
              width={GRID_SIZE}
              height={GRID_SIZE}
            />
          {/if}
        {/each}
      {/each}

      {#each map.tokens as t (t.id)}
        {@const tc = ((t.size ?? 1) * GRID_SIZE) / 2}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="tok"
          class:sel={t.id === selected}
          transform="translate({t.gx * GRID_SIZE} {t.gy * GRID_SIZE})"
          onpointerdown={(e) => onTokenDown(e, t.id)}
        >
          <circle cx={tc} cy={tc} r={tc - 4} fill={t.color} />
          <text x={tc} y={tc + 4} text-anchor="middle" class="lbl">
            {t.label}
          </text>
          <!-- full state labels stacked below the token (glyph + name) -->
          {#each t.conditions as cid, i (cid)}
            <text
              x={tc}
              y={(t.size ?? 1) * GRID_SIZE + 12 + i * 13}
              text-anchor="middle"
              class="condlabel"
              role="img"
              aria-label={conditionMeta(cid)?.label ?? cid}
            >
              {conditionGlyph(cid)} {conditionMeta(cid)?.label ?? cid}
            </text>
          {/each}
        </g>
      {/each}

      <!-- Region-reveal marquee -->
      {#if region}
        {@const rx = Math.min(region.c0, region.c1) * GRID_SIZE}
        {@const ry = Math.min(region.r0, region.r1) * GRID_SIZE}
        {@const rw = (Math.abs(region.c1 - region.c0) + 1) * GRID_SIZE}
        {@const rh = (Math.abs(region.r1 - region.r0) + 1) * GRID_SIZE}
        <rect class="marquee" x={rx} y={ry} width={rw} height={rh} />
      {/if}

      <!-- Ruler calibration line -->
      {#if ruler}
        <line class="ruler" x1={ruler.x1} y1={ruler.y1} x2={ruler.x2} y2={ruler.y2} />
        <circle class="rulerend" cx={ruler.x1} cy={ruler.y1} r="4" />
        <circle class="rulerend" cx={ruler.x2} cy={ruler.y2} r="4" />
      {/if}

      <!-- GM-only annotation strokes (never broadcast) -->
      {#each strokes as st, i (i)}
        <path class="ink" d={strokePath(st.pts)} />
      {/each}
      {#if curStroke && curStroke.length > 1}
        <path class="ink" d={strokePath(curStroke)} />
      {/if}

      <!-- Measure overlay: line / circle burst / 60° cone (GM-only) -->
      {#if measure}
        {@const dx = measure.x2 - measure.x1}
        {@const dy = measure.y2 - measure.y1}
        {@const len = Math.hypot(dx, dy)}
        {#if measureShape === 'circle'}
          <circle class="aoe" cx={measure.x1} cy={measure.y1} r={len} />
        {:else if measureShape === 'cone' && len > 0}
          {@const ux = dx / len}
          {@const uy = dy / len}
          {@const ang = Math.PI / 6}
          {@const lx = measure.x1 + (ux * Math.cos(ang) - uy * Math.sin(ang)) * len}
          {@const ly = measure.y1 + (ux * Math.sin(ang) + uy * Math.cos(ang)) * len}
          {@const rx = measure.x1 + (ux * Math.cos(-ang) - uy * Math.sin(-ang)) * len}
          {@const ry = measure.y1 + (ux * Math.sin(-ang) + uy * Math.cos(-ang)) * len}
          <path class="aoe" d="M{measure.x1},{measure.y1} L{lx},{ly} L{rx},{ry} Z" />
        {:else}
          <line class="measureline" x1={measure.x1} y1={measure.y1} x2={measure.x2} y2={measure.y2} />
        {/if}
        <text class="measuretxt" x={measure.x2 + 6} y={measure.y2 - 6}>{measureLenM.toFixed(1)} m</text>
      {/if}

      <!-- Grid-sync calibration box -->
      {#if gridBox}
        <rect
          class="gridbox"
          x={Math.min(gridBox.x1, gridBox.x2)}
          y={Math.min(gridBox.y1, gridBox.y2)}
          width={Math.abs(gridBox.x2 - gridBox.x1)}
          height={Math.abs(gridBox.y2 - gridBox.y1)}
        />
      {/if}

      <!-- Committed broadcast frame (what players see) -->
      {#if map.view}
        <rect
          class="viewframe"
          x={map.view.x}
          y={map.view.y}
          width={map.view.w}
          height={map.view.h}
        />
      {/if}
      <!-- Broadcast frame while dragging -->
      {#if frameBox}
        <rect
          class="viewframe live"
          x={Math.min(frameBox.x1, frameBox.x2)}
          y={Math.min(frameBox.y1, frameBox.y2)}
          width={Math.abs(frameBox.x2 - frameBox.x1)}
          height={Math.abs(frameBox.y2 - frameBox.y1)}
        />
      {/if}
    </g>
  </svg>

  <div class="controls">
  <div class="toolbar">
    <button class="btn sm" onclick={() => map.addToken(snapToCell(-map.transform.panX), 0, 'New')}>
      {t('map.addToken')}
    </button>
    <button class="btn sm" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} onclick={() => map.zoomBy(1.1)}><Icon name="plus" /></button>
    <button class="btn sm" aria-label={t('map.zoomOut')} onclick={() => map.zoomBy(0.9)}>－</button>
    <button
      class="btn sm"
      class:on={fogTool === 'reveal'}
      onclick={() => (fogTool = fogTool === 'reveal' ? 'off' : 'reveal')}
      title={t('map.revealTitle')}>{t('map.reveal')}</button
    >
    <button
      class="btn sm"
      class:on={fogTool === 'hide'}
      onclick={() => (fogTool = fogTool === 'hide' ? 'off' : 'hide')}
      title={t('map.hideTitle')}>{t('map.hide')}</button
    >
    <button
      class="btn sm"
      class:on={fogTool === 'region'}
      onclick={() => (fogTool = fogTool === 'region' ? 'off' : 'region')}
      title={t('map.regionTitle')}>{t('map.region')}</button
    >
    <button class="btn sm" onclick={() => map.revealAll()} title={t('map.revealAllTitle')}
      >{t('map.revealAll')}</button
    >
    <button class="btn sm" onclick={() => map.clearFog()} title={t('map.fogAllTitle')}
      >{t('map.fogAll')}</button
    >
    <button
      class="btn sm"
      class:on={fogTool === 'ping'}
      onclick={() => (fogTool = fogTool === 'ping' ? 'off' : 'ping')}
      title={t('map.pingTitle')}>{t('map.ping')}</button
    >
    <label class="btn sm" title={t('map.bgTitle')}>
      {t('map.bg')}
      <input class="hidden" type="file" accept="image/*" onchange={pickBg} aria-label={t('map.bg')} />
    </label>
    <button
      class="btn sm"
      class:on={fogTool === 'ruler'}
      disabled={!map.bg}
      onclick={() => {
        fogTool = fogTool === 'ruler' ? 'off' : 'ruler';
        ruler = null;
      }}
      title={t('map.rulerTitle')}>{t('map.ruler')}</button
    >
    <button
      class="btn sm"
      class:on={fogTool === 'gridcal'}
      disabled={!map.bg}
      onclick={() => {
        fogTool = fogTool === 'gridcal' ? 'off' : 'gridcal';
        gridBox = null;
      }}
      title={t('map.gridSyncTitle')}>{t('map.gridSync')}</button
    >
    {#if map.bg}
      <button class="btn sm danger" onclick={() => map.clearBg()} title={t('map.clearBgTitle')}
        >{t('map.clearBg')}</button
      >
    {/if}
    <button
      class="btn sm"
      class:on={fogTool === 'frame'}
      onclick={() => {
        fogTool = fogTool === 'frame' ? 'off' : 'frame';
        frameBox = null;
      }}
      title={t('map.frameTitle')}>{t('map.frame')}</button
    >
    {#if map.view}
      <button class="btn sm" onclick={() => map.clearView()} title={t('map.frameFullTitle')}
        >{t('map.frameFull')}</button
      >
    {/if}
    <button class="btn sm" onclick={() => map.cycleGridMode()} title={t('map.gridModeTitle')}>
      ⬡ {t(GRID_LABEL[map.gridMode])}
    </button>
    <button
      class="btn sm"
      class:on={fogTool === 'measure'}
      onclick={() => {
        fogTool = fogTool === 'measure' ? 'off' : 'measure';
        measure = null;
      }}
      title={t('map.measureTitle')}>{t('map.measure')}</button
    >
    <button
      class="btn sm"
      class:on={fogTool === 'draw'}
      onclick={() => (fogTool = fogTool === 'draw' ? 'off' : 'draw')}
      title={t('map.drawTitle')}>{t('map.draw')}</button
    >
    <button
      class="btn sm"
      class:on={libraryOpen}
      onclick={() => {
        libraryOpen = !libraryOpen;
        if (libraryOpen) void refreshMaps();
      }}
      title={t('map.mapsTitle')}>{t('map.maps')}</button
    >
    <button class="btn sm solid" onclick={putMapOnAir} title={t('map.onAirTitle')}>{t('map.onAir')}</button>
  </div>

  {#if libraryOpen}
    <div class="library">
      <div class="librow">
        <input class="tname" placeholder={t('map.mapName')} bind:value={mapName} aria-label={t('map.mapName')} />
        <button class="btn sm solid" onclick={saveCurrentMap}>{t('map.saveMap')}</button>
      </div>
      {#if savedMaps.length}
        <ul class="maplist">
          {#each savedMaps as m (m.id)}
            <li>
              <button class="maploadbtn" onclick={() => loadSavedMap(m.id)}>{m.name}</button>
              <button class="btn sm danger" onclick={() => deleteSavedMap(m.id)} aria-label={t('map.deleteMap')} title={t('map.deleteMap')}><Icon name="trash" size={13} /></button>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="chint">{t('map.noMaps')}</span>
      {/if}
    </div>
  {/if}

  {#if fogTool === 'ruler'}
    <div class="calib">
      <span class="chint">{t('map.rulerHint')}</span>
      {#if ruler}
        <span class="clen">≈ {rulerLenM.toFixed(1)} m</span>
        <label class="cfield">
          {t('map.meters')}
          <input
            type="number"
            min="0.1"
            step="0.1"
            bind:value={rulerMeters}
            aria-label={t('map.meters')}
          />
        </label>
        <button class="btn sm solid" onclick={applyRuler}>{t('map.applyScale')}</button>
      {/if}
    </div>
  {/if}

  {#if fogTool === 'gridcal'}
    <div class="calib">
      <span class="chint">{t('map.gridSyncHint')}</span>
      {#if gridBox}
        <label class="cfield">
          {t('map.cols')}
          <input type="number" min="1" step="1" bind:value={gcCols} aria-label={t('map.cols')} />
        </label>
        <label class="cfield">
          {t('map.rows')}
          <input type="number" min="1" step="1" bind:value={gcRows} aria-label={t('map.rows')} />
        </label>
        <button class="btn sm solid" onclick={applyGridcal}>{t('map.applyScale')}</button>
      {/if}
    </div>
  {/if}

  {#if fogTool === 'frame'}
    <div class="calib">
      <span class="chint">{t('map.frameHint')}</span>
    </div>
  {/if}

  {#if fogTool === 'measure'}
    <div class="calib">
      <span class="chint">{t('map.measureHint')}</span>
      <div class="seg">
        <button class="btn sm" class:on={measureShape === 'line'} onclick={() => (measureShape = 'line')}>{t('map.aoeLine')}</button>
        <button class="btn sm" class:on={measureShape === 'circle'} onclick={() => (measureShape = 'circle')}>{t('map.aoeCircle')}</button>
        <button class="btn sm" class:on={measureShape === 'cone'} onclick={() => (measureShape = 'cone')}>{t('map.aoeCone')}</button>
      </div>
    </div>
  {/if}

  {#if fogTool === 'draw'}
    <div class="calib">
      <span class="chint">{t('map.drawHint')}</span>
      <button class="btn sm" onclick={undoDrawing} disabled={!strokes.length}>{t('map.undoDraw')}</button>
      <button class="btn sm danger" onclick={clearDrawings} disabled={!strokes.length}>{t('map.clearDraw')}</button>
    </div>
  {/if}
  </div>

  {#if sel}
    <div class="inspect">
      <input
        class="tname"
        value={sel.label}
        aria-label={t('map.tokenName')}
        oninput={(e) => map.setLabel(sel.id, (e.currentTarget as HTMLInputElement).value)}
      />
      <span class="hp">{sel.hp}/{sel.maxHp}</span>
      <button class="btn sm" onclick={() => damage(sel, -1)}>−1</button>
      <button class="btn sm" onclick={() => damage(sel, 1)}>+1</button>
      <label class="sizepick" title={t('map.size')}>
        {t('map.size')}
        <select value={sel.size ?? 1} onchange={(e) => map.setTokenSize(sel.id, Number((e.currentTarget as HTMLSelectElement).value))} aria-label={t('map.size')}>
          <option value={1}>1×1</option>
          <option value={2}>2×2</option>
          <option value={3}>3×3</option>
          <option value={4}>4×4</option>
        </select>
      </label>

      <!-- active states as removable glyph chips -->
      {#each sel.conditions as cid (cid)}
        <button
          class="statechip on"
          title={conditionMeta(cid)?.label ?? cid}
          aria-label={`${conditionMeta(cid)?.label ?? cid} — remove`}
          onclick={() => map.toggleCondition(sel.id, cid)}>{conditionGlyph(cid)}</button
        >
      {/each}

      <!-- compact state picker -->
      <div class="statepick">
        <button
          class="btn sm"
          class:on={statesOpen}
          aria-haspopup="menu"
          aria-expanded={statesOpen}
          onclick={() => (statesOpen = !statesOpen)}
          title={t('map.statesTitle')}>{t('map.states')}</button
        >
        {#if statesOpen}
          <div class="statemenu" role="menu" aria-label={t('map.statesTitle')}>
            {#each conditionCatalog as c (c.id)}
              <button
                class="stateopt"
                class:on={sel.conditions.includes(c.id)}
                role="menuitemcheckbox"
                aria-checked={sel.conditions.includes(c.id)}
                title={c.label}
                onclick={() => map.toggleCondition(sel.id, c.id)}
              >
                <span class="og">{c.glyph}</span><span class="ol">{c.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <button class="btn sm danger" aria-label={t('map.removeToken')} title={t('map.removeToken')} onclick={() => map.removeToken(sel.id)}><Icon name="trash" size={13} /></button>
    </div>
  {/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 240px;
    overflow: hidden;
    border-radius: var(--r2);
    background: var(--bg);
  }
  .canvas {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  /* GPU-composited background layer, transformed with the same pan/zoom as the
     SVG so it stays aligned but never re-rasterises on overlay updates. */
  .bg-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    transform-origin: 0 0;
    pointer-events: none;
    will-change: transform;
  }
  .bg-img {
    position: absolute;
    max-width: none;
    max-height: none;
  }
  .tok {
    cursor: move;
  }
  .tok.sel circle {
    stroke: var(--green);
    stroke-width: 2;
  }
  .lbl {
    fill: var(--ink);
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
  }
  /* state labels under the token: light fill with a dark halo so they read on
     any map background */
  .condlabel {
    font-size: 10px;
    font-weight: 600;
    fill: #eafff3;
    stroke: #05090a;
    stroke-width: 2.6;
    paint-order: stroke;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .fog {
    fill: rgba(4, 9, 8, 0.62);
    pointer-events: none;
  }
  .marquee {
    fill: var(--fill-g14);
    stroke: var(--green);
    stroke-width: 1.5;
    stroke-dasharray: 5 3;
    pointer-events: none;
  }
  .ruler {
    stroke: var(--green);
    stroke-width: 2;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }
  .rulerend {
    fill: var(--green);
    pointer-events: none;
  }
  .measureline {
    stroke: #8fd8ff;
    stroke-width: 2;
    pointer-events: none;
  }
  .aoe {
    fill: rgba(143, 216, 255, 0.18);
    stroke: #8fd8ff;
    stroke-width: 1.5;
    pointer-events: none;
  }
  .measuretxt {
    fill: #d7f1ff;
    font-size: 12px;
    font-weight: 700;
    paint-order: stroke;
    stroke: #05090a;
    stroke-width: 3;
    pointer-events: none;
  }
  .ink {
    fill: none;
    stroke: #ffd27a;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .seg {
    display: inline-flex;
    gap: 4px;
  }
  .gridbox {
    fill: var(--fill-g14);
    stroke: var(--green);
    stroke-width: 1.5;
    stroke-dasharray: 6 3;
    pointer-events: none;
  }
  .viewframe {
    fill: none;
    stroke: var(--eye);
    stroke-width: 2;
    stroke-dasharray: 9 5;
    pointer-events: none;
  }
  .viewframe.live {
    fill: var(--fill-g08);
  }
  /* Stack the toolbar and any calibration panel so a wrapped toolbar never
     overlaps (and blocks clicks on) the panel below it. */
  .controls {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    pointer-events: none;
  }
  .controls > * {
    pointer-events: auto;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    max-width: 100%;
  }
  .calib {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--r2);
    background: var(--menu-bg);
    border: 1px solid var(--green);
    font-size: 12px;
    color: var(--txt);
  }
  .chint {
    color: var(--muted);
  }
  .library {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: var(--r2);
    background: var(--menu-bg);
    border: 1px solid var(--line2);
    font-size: 12px;
  }
  .librow {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .maplist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 160px;
    overflow-y: auto;
  }
  .maplist li {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .maploadbtn {
    flex: 1;
    text-align: left;
    padding: 5px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .maploadbtn:hover {
    border-color: var(--green-dim);
    background: var(--fill-g14);
  }
  .sizepick {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
  }
  .sizepick select {
    background: var(--bg1);
    color: var(--txt);
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    font: inherit;
    font-size: 11px;
    padding: 2px 4px;
  }
  .clen {
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .cfield {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
  }
  .cfield input {
    width: 64px;
    padding: 3px 5px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .hidden {
    display: none;
  }
  .btn.sm:disabled {
    opacity: 0.4;
    cursor: default;
  }
  /* file-picker label styled as a button */
  label.btn.sm {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }
  .inspect {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 7px 10px;
    border-radius: var(--r2);
    background: var(--menu-bg);
    border: 1px solid var(--line2);
    font-size: 12px;
    color: var(--txt);
  }
  .inspect .hp {
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .tname {
    width: 110px;
    padding: 3px 6px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  .tname:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  /* active-state chips (glyph only, click to remove) */
  .statechip {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    line-height: 1;
    border-radius: var(--r2);
    border: 1px solid var(--focus);
    background: var(--fill-g14);
    cursor: pointer;
  }
  .statechip:hover {
    background: var(--fill-g22);
  }
  /* state picker */
  .statepick {
    position: relative;
  }
  .statemenu {
    position: absolute;
    bottom: 30px;
    left: 0;
    z-index: 30;
    width: 188px;
    max-height: 220px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    padding: 6px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 14px 40px -16px rgba(0, 0, 0, 0.9);
  }
  .stateopt {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 5px;
    border: 1px solid transparent;
    border-radius: var(--r2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
    text-align: left;
  }
  .stateopt:hover {
    color: var(--txt);
    background: var(--fill-g08);
  }
  .stateopt.on {
    color: var(--txt);
    border-color: var(--focus);
    background: var(--fill-g14);
  }
  .stateopt .og {
    font-size: 13px;
    flex: 0 0 auto;
  }
  .stateopt .ol {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btn.sm {
    padding: 4px 9px;
    font-size: 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm.on {
    background: var(--fill-g14);
    border-color: var(--focus);
  }
  .btn.sm.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: var(--ink);
    font-weight: 700;
  }
  .btn.sm.danger:hover {
    border-color: var(--red);
    color: var(--red);
  }
</style>
