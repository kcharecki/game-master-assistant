<script lang="ts">
  import { onMount } from 'svelte';
  import { stage, type Tile, type TileKind } from './store.svelte';
  import { formatCountdown, resolveTiles, BUILTIN_TEMPLATES, type Template } from './board';
  import { npcs } from '../npcs/store.svelte';
  import { loc, type LocalizedText } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import { calendar } from '../calendar/store.svelte';
  import { onairHistory } from '../../lib/stores/onairHistory.svelte';
  import { describeOnAir } from '../../lib/onair';
  import { assetPut, assetUrl } from '../../lib/db';
  import { putOnAir, clearBroadcast, setDisplayMode, setMood } from '../reveal/bus-actions';
  import { sendLaser } from './bus-actions';
  import { DEFAULT_DISPLAY_MODE } from '../../broadcast/display';
  import { MOODS, DEFAULT_MOOD } from '../../broadcast/mood';
  import type { DisplayMode, GridArea } from '../../lib/types';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import NpcPeek from '../../lib/components/NpcPeek.svelte';

  const g = (v: LocalizedText | undefined) => loc(v, lang.current);
  const KINDS: TileKind[] = ['image', 'text', 'npc', 'clock', 'date'];

  let board = $state<HTMLDivElement | null>(null);
  let hovered = $state(false);
  let display = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  let moodId = $state(DEFAULT_MOOD.id);
  let laserOn = $state(false);
  let lastLaser = 0;

  // --- chrome state ---------------------------------------------------------
  let addMenu = $state(false);
  let moodMenu = $state(false);
  let displayMenu = $state(false);
  let kindMenu = $state(false);
  let layerMenu = $state(false);
  let editOpen = $state(false);

  function closeGlobalMenus() {
    addMenu = moodMenu = displayMenu = false;
  }
  function closeTileMenus() {
    kindMenu = layerMenu = false;
  }
  function closeAllMenus() {
    closeGlobalMenus();
    closeTileMenus();
  }

  let peek: ReturnType<typeof NpcPeek> | undefined;
  function pickBroadcastImage(assetId: string, id: string) {
    npcs.setPrimaryPhoto(id, assetId);
    if (stage.live) stage.broadcast();
  }

  const cols = $derived(stage.active.cols);
  const rows = $derived(stage.active.rows);
  const sel = $derived(stage.tiles.find((tl) => tl.id === stage.selected) ?? null);
  const variantName = $derived(
    stage.active.variants.find((v) => v.id === stage.activeVariantId)?.name ?? t('stage.baseVariant'),
  );

  onMount(() => {
    stage.onAir = putOnAir;
    void stage.load();
    void npcs.load();
    void calendar.load();
    const onPaste = (e: ClipboardEvent) => void handlePaste(e);
    const onKey = (e: KeyboardEvent) => handleKey(e);
    const onDocDown = () => closeAllMenus();
    const onReflow = () => syncAnchor();
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  });

  $effect(() => {
    void stage.selected;
    editOpen = false;
    closeTileMenus();
    queueMicrotask(syncAnchor);
  });

  // --- asset URL resolution (cursor + armed + air beats, npc portraits) -----
  let urls = $state<Record<string, string>>({});
  function collectAssets(want: Set<string>, tiles: Tile[]) {
    for (const tl of tiles) {
      if (tl.kind === 'image' && tl.assetId) want.add(tl.assetId);
      if (tl.kind === 'npc' && tl.npcId) {
        const p = stage.npcLookup(tl.npcId);
        if (p?.portraitId) want.add(p.portraitId);
      }
    }
  }
  $effect(() => {
    const want = new Set<string>();
    collectAssets(want, stage.tiles);
    if (stage.mode === 'run') {
      collectAssets(want, resolveTiles(stage.armed, stage.armedVariantId));
      if (stage.air) {
        const ab = stage.beatById(stage.air.beatId);
        if (ab) collectAssets(want, resolveTiles(ab, stage.air.variantId));
      }
    }
    for (const n of npcs.list) if (n.portraitId) want.add(n.portraitId);
    for (const [id, url] of Object.entries(urls)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete urls[id];
      }
    }
    for (const id of want) {
      if (!urls[id]) void assetUrl(id).then((u) => u && (urls[id] = u));
    }
  });
  $effect(() => () => {
    for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  });

  function tileImg(tl: Tile): string | undefined {
    if (tl.kind === 'image') return tl.assetId ? urls[tl.assetId] : tl.src;
    if (tl.kind === 'npc' && tl.npcId) {
      const p = stage.npcLookup(tl.npcId);
      return p?.portraitId ? urls[p.portraitId] : undefined;
    }
    return undefined;
  }
  function npcCaption(tl: Tile): string {
    const p = tl.npcId ? stage.npcLookup(tl.npcId) : undefined;
    if (!p) return '—';
    return p.role ? `${p.name} — ${p.role}` : p.name;
  }
  function kindLabel(k: TileKind): string {
    return t('stage.kind' + k.charAt(0).toUpperCase() + k.slice(1));
  }
  function kindTint(k: TileKind): string {
    if (k === 'image' || k === 'npc') return '#22301f';
    if (k === 'text') return '#3a3226';
    return '#1a251d';
  }
  function visible(tiles: Tile[]): Tile[] {
    return tiles.filter((tl) => !tl.hidden);
  }

  // --- selected-tile anchor -------------------------------------------------
  let anchor = $state<{ left: number; top: number; right: number; bottom: number; w: number } | null>(
    null,
  );
  function syncAnchor() {
    const id = stage.selected;
    if (!id) {
      anchor = null;
      return;
    }
    const el = board?.querySelector(`[data-tile="${id}"]`) as HTMLElement | null;
    if (!el) {
      anchor = null;
      return;
    }
    const r = el.getBoundingClientRect();
    anchor = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width };
  }
  const barStyle = $derived(
    anchor ? `left:${anchor.left}px; top:${anchor.top - 8}px` : 'display:none',
  );
  const popStyle = $derived.by(() => {
    if (!anchor) return 'display:none';
    const wantLeft = anchor.right + 300 > window.innerWidth;
    const x = wantLeft ? `right:${window.innerWidth - anchor.left + 8}px` : `left:${anchor.right + 8}px`;
    return `${x}; top:${anchor.top}px`;
  });

  // --- pointer geometry -----------------------------------------------------
  function frac(e: PointerEvent | DragEvent): { fx: number; fy: number } {
    const r = board?.getBoundingClientRect();
    if (!r) return { fx: 0, fy: 0 };
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
  }
  function cellAt(e: PointerEvent | DragEvent): { col: number; row: number } {
    const { fx, fy } = frac(e);
    return {
      col: Math.min(cols, Math.max(1, Math.floor(fx * cols) + 1)),
      row: Math.min(rows, Math.max(1, Math.floor(fy * rows) + 1)),
    };
  }

  // --- tile move ------------------------------------------------------------
  let moving = $state<string | null>(null);
  let grabCol = 0;
  let grabRow = 0;

  function startMove(e: PointerEvent, tl: Tile) {
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    e.preventDefault();
    peek?.cancel();
    stage.beginGesture();
    stage.selected = tl.id;
    stage.raise(tl.id);
    moving = tl.id;
    const c = cellAt(e);
    grabCol = c.col - tl.col;
    grabRow = c.row - tl.row;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (moving) {
      const c = cellAt(e);
      const tl = stage.tiles.find((x) => x.id === moving)!;
      stage.placeTile(moving, { col: c.col - grabCol, row: c.row - grabRow, cw: tl.cw, rh: tl.rh });
      syncAnchor();
    } else if (resizing) {
      const c = cellAt(e);
      const tl = stage.tiles.find((x) => x.id === resizing)!;
      stage.placeTile(resizing, {
        col: tl.col,
        row: tl.row,
        cw: Math.max(1, c.col - tl.col + 1),
        rh: Math.max(1, c.row - tl.row + 1),
      });
      syncAnchor();
    }
  }
  function endMove(e: PointerEvent) {
    moving = null;
    resizing = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    syncAnchor();
  }

  let resizing = $state<string | null>(null);
  function startResize(e: PointerEvent, tl: Tile) {
    e.preventDefault();
    e.stopPropagation();
    stage.beginGesture();
    stage.selected = tl.id;
    resizing = tl.id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  // --- OS drag-drop + clipboard --------------------------------------------
  let dragOver = $state(false);
  async function fileToTile(file: File, place?: GridArea) {
    if (!file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    const tl = stage.addTile('image', { assetId });
    if (place) stage.placeTile(tl.id, place);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const c = cellAt(e);
    const npcId = e.dataTransfer?.getData('application/x-stage-npc');
    if (npcId) {
      const tl = stage.addTile('npc', { npcId });
      stage.placeTile(tl.id, { col: c.col, row: c.row, cw: tl.cw, rh: tl.rh });
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (file) void fileToTile(file, { col: c.col, row: c.row, cw: 6, rh: 4 });
  }
  async function handlePaste(e: ClipboardEvent) {
    if (!hovered) return;
    const items = e.clipboardData?.items ?? [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          await fileToTile(file);
          return;
        }
      }
    }
    const text = e.clipboardData?.getData('text/plain');
    if (text && hovered) {
      e.preventDefault();
      stage.addTile('text', { body: text });
    }
  }

  // --- keyboard -------------------------------------------------------------
  function isTyping(e: KeyboardEvent): boolean {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
  function handleKey(e: KeyboardEvent) {
    if (isTyping(e)) return;
    // RUN cockpit shortcuts.
    if (stage.mode === 'run') {
      if (e.key === ' ') {
        e.preventDefault();
        stage.take();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stage.armRelative(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stage.armRelative(-1);
      } else if (e.key === 'v' || e.key === 'V') {
        stage.cycleArmedVariant();
      } else if (e.key === 'p' || e.key === 'P') {
        clearBroadcast();
      } else if (/^[1-9]$/.test(e.key)) {
        const b = stage.beats[Number(e.key) - 1];
        if (b) stage.arm(b.id);
      }
      return;
    }
    // PLAN tile nudges.
    if (!hovered || !stage.selected) return;
    const tl = stage.tiles.find((x) => x.id === stage.selected);
    if (!tl) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      stage.removeTile(tl.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stage.patchTile(tl.id, { col: tl.col - 1 });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stage.patchTile(tl.id, { col: tl.col + 1 });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stage.patchTile(tl.id, { row: tl.row - 1 });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stage.patchTile(tl.id, { row: tl.row + 1 });
    }
    syncAnchor();
  }

  // --- add menu -------------------------------------------------------------
  function addKind(kind: TileKind) {
    if (kind === 'date') addDateTile();
    else if (kind === 'clock') stage.addTile('clock', { seconds: 60 });
    else stage.addTile(kind);
    addMenu = false;
  }

  // --- edit actions ---------------------------------------------------------
  async function pickImage(e: Event, id: string) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const assetId = await assetPut(file, file.type || 'image/png');
    stage.patchTile(id, { assetId, src: undefined });
  }
  function pickDisplay(m: DisplayMode) {
    display = m;
    setDisplayMode(m);
  }
  function pickMood(id: string) {
    moodId = id;
    setMood(id);
  }
  function addDateTile() {
    stage.addTile('date', { date: calendar.label, time: calendar.clock, moon: calendar.moon });
  }
  function refreshDate(tl: Tile) {
    stage.patchTile(tl.id, { date: calendar.label, time: calendar.clock, moon: calendar.moon });
  }

  // --- laser pointer --------------------------------------------------------
  function toggleLaser() {
    laserOn = !laserOn;
    if (!laserOn) sendLaser(0, 0, false);
  }
  function boardLaser(e: PointerEvent) {
    if (!laserOn) return;
    const now = performance.now();
    if (now - lastLaser < 30) return;
    lastLaser = now;
    const { fx, fy } = frac(e);
    sendLaser(fx, fy, true);
  }

  // --- rundown / templates / variants / forks -------------------------------
  let editingBeat = $state<string | null>(null);
  let editingVariant = $state<string | null>(null);
  let editingFork = $state<string | null>(null);
  let dragBeat = $state<string | null>(null);
  let dropIndex = $state<number | null>(null);

  // Inline "add" fields — no browser prompts. Enter commits, blur/Esc cancels.
  let addingTemplate = $state(false);
  let addingVariant = $state(false);
  let addingFork = $state(false);

  function useBuiltin(nameKey: string, slots: Template['slots']) {
    stage.addBeatFrom({ id: crypto.randomUUID(), name: t(nameKey), cols, rows, slots });
  }
  function commitTemplate(v: string) {
    const n = v.trim();
    if (n) stage.saveTemplate(n);
    addingTemplate = false;
  }
  function commitVariant(v: string) {
    const n = v.trim();
    if (n) stage.addVariant(n);
    addingVariant = false;
  }
  function commitFork(v: string) {
    const n = v.trim();
    if (n) stage.addFork(stage.active.id, n);
    addingFork = false;
  }
  function beatDrop(toIndex: number) {
    if (dragBeat) stage.moveBeat(dragBeat, toIndex);
    dragBeat = null;
    dropIndex = null;
  }

  const airBeat = $derived(stage.air ? stage.beatById(stage.air.beatId) : undefined);
  const airTiles = $derived(airBeat ? visible(resolveTiles(airBeat, stage.air!.variantId)) : []);
  const previewTiles = $derived(visible(resolveTiles(stage.armed, stage.armedVariantId)));
  const armedVariantName = $derived(
    stage.armed.variants.find((v) => v.id === stage.armedVariantId)?.name ?? t('stage.baseVariant'),
  );
</script>

{#snippet tileContent(tl: Tile)}
  {#if tl.kind === 'text'}
    {#if tl.title || tl.body}
      <div
        class="ttext"
        class:parchment={tl.theme === 'parchment'}
        class:letter={tl.theme === 'letter'}
        class:telegram={tl.theme === 'telegram'}
      >
        {#if tl.title}<strong>{tl.title}</strong>{/if}
        {#if tl.body}<span>{tl.body}</span>{/if}
      </div>
    {:else}
      <div class="ph">{t('stage.bodyPlaceholder')}</div>
    {/if}
  {:else if tl.kind === 'clock'}
    <div class="tmeta">
      {#if tl.title}<span class="tmlbl">{tl.title}</span>{/if}
      <strong class="tmbig">{formatCountdown(tl.seconds ?? 60)}</strong>
    </div>
  {:else if tl.kind === 'date'}
    <div class="tmeta">
      {#if tl.title}<span class="tmlbl">{tl.title}</span>{/if}
      <strong class="tmmid">{tl.date ?? '—'}</strong>
      {#if tl.time}<span class="ttime">{tl.time}</span>{/if}
      {#if tl.moon}<span class="tmoon"><Icon name="moon" size={14} /> {tl.moon}</span>{/if}
    </div>
  {:else}
    {@const img = tileImg(tl)}
    {#if img}
      <img class="timg" src={img} alt={tl.caption ?? ''} />
      {#if tl.kind === 'npc' || tl.caption}
        <div class="tcap">{tl.kind === 'npc' ? npcCaption(tl) : tl.caption}</div>
      {/if}
    {:else if tl.kind === 'npc'}
      <div class="ttext"><strong>{npcCaption(tl)}</strong></div>
    {:else}
      <div class="ph">{t('stage.dropHere')}</div>
    {/if}
  {/if}
{/snippet}

{#snippet miniBoard(tiles: Tile[], bcols: number, brows: number, empty: string)}
  <div class="st-mini" style="grid-template-columns: repeat({bcols}, 1fr); grid-template-rows: repeat({brows}, 1fr)">
    {#each tiles as tl (tl.id)}
      <div
        class="tile"
        style="grid-column: {tl.col} / span {tl.cw}; grid-row: {tl.row} / span {tl.rh}{tl.z !== undefined ? `; z-index:${tl.z}` : ''}"
      >
        <div class="content">{@render tileContent(tl)}</div>
      </div>
    {/each}
    {#if tiles.length === 0}<div class="st-miniempty">{empty}</div>{/if}
  </div>
{/snippet}

<div class="stage">
  <!-- top bar -->
  <div class="st-top">
    <span class="st-wm">{t('stage.wordmark')}</span>
    <div class="st-modes" role="tablist" aria-label={t('stage.mode')}>
      <button class="st-mode" class:on={stage.mode === 'plan'} role="tab" aria-selected={stage.mode === 'plan'} onclick={() => stage.setMode('plan')}>{t('stage.plan')}</button>
      <button class="st-mode" class:on={stage.mode === 'run'} role="tab" aria-selected={stage.mode === 'run'} onclick={() => stage.setMode('run')}>{t('stage.run')}</button>
    </div>
    <span class="st-sess">{stage.active.name}</span>
    {#if stage.mode === 'run'}
      <div class="st-moods" title={t('stage.mood')}>
        {#each MOODS as m (m.id)}
          <button class="st-moodchip" class:on={moodId === m.id} style="background:rgb({m.tint})" aria-label={m.label} title={m.label} onclick={() => pickMood(m.id)}></button>
        {/each}
      </div>
    {/if}
    <div class="st-topright">
      <span class="st-status" class:live={stage.air !== null || stage.live}>
        <i></i>{stage.air !== null || stage.live ? t('stage.statusLive') : t('stage.statusOff')}
      </span>
      <button class="btn panic" onclick={() => { clearBroadcast(); stage.air = null; }} title={t('onair.panicTitle')}>{t('stage.panic')}</button>
    </div>
  </div>

  {#if stage.mode === 'run'}
    <!-- ===================== RUN COCKPIT ===================== -->
    <div class="st-cockpit">
      <!-- AIR -->
      <div class="st-air">
        <div class="st-airlbl">{t('stage.airLabel')}</div>
        <div class="st-frame air">
          {@render miniBoard(airTiles, airBeat?.cols ?? cols, airBeat?.rows ?? rows, t('stage.airEmpty'))}
        </div>
        <div class="st-framemeta">
          {#if airBeat}{airBeat.name}{:else}{t('stage.offAir')}{/if}
        </div>
      </div>

      <!-- TAKE -->
      <div class="st-takecol">
        <button class="st-take" disabled={!stage.previewArmed} onclick={() => stage.take()}>
          <span class="st-taketxt">{t('stage.take')}</span>
          <span class="st-takekey">SPACE</span>
        </button>
        <div class="st-liveedit">
          <span class="st-lelbl">{t('stage.liveEdit')}</span>
          <button class="st-toggle" class:on={stage.live} aria-pressed={stage.live} aria-label={t('stage.liveEdit')} onclick={() => stage.toggleLive()}><i></i></button>
          <span class="st-lehint">{t('stage.liveEditHint')}</span>
        </div>
      </div>

      <!-- PREVIEW -->
      <div class="st-preview">
        <div class="st-prevhd">
          <span class="st-prevlbl">{t('stage.previewLabel')} · {stage.armed.name}</span>
          {#if stage.armed.variants.length}
            <button class="st-vcycle" onclick={() => stage.cycleArmedVariant()} title={t('stage.cycleVariant')}>◆ {armedVariantName}</button>
          {/if}
        </div>
        <div class="st-frame prev">
          {@render miniBoard(previewTiles, stage.armed.cols, stage.armed.rows, t('stage.previewEmpty'))}
        </div>
        <div class="st-framemeta">{t('stage.previewHint')}</div>
      </div>
    </div>

    <!-- run rundown with playhead -->
    <div class="st-rundown">
      <div class="st-rhd">
        <span class="st-rlbl">{t('stage.playhead')} · {stage.active.name}</span>
        <span class="st-rhint">{t('stage.runHint')}</span>
      </div>
      <div class="st-spine">
        {#each stage.beats as b, i (b.id)}
          {@const aired = stage.air?.beatId === b.id}
          {@const isArmed = stage.armedId === b.id}
          <div class="st-runbeatwrap">
            <button
              class="st-runbeat"
              class:aired
              class:armed={isArmed}
              onclick={() => stage.arm(b.id)}
            >
              <div class="st-brow">
                <span class="st-bnum">{String(i + 1).padStart(2, '0')}{#if aired} ●{/if}</span>
                {#if isArmed}<span class="st-barmed">{t('stage.armed')}</span>{/if}
              </div>
              <div class="st-bname">{b.name}</div>
            </button>
            {#if b.forks.length}
              <div class="st-forkchips">
                {#each b.forks as f (f.id)}
                  <button
                    class="st-forkchip"
                    class:armed={f.targetBeatId === stage.armedId}
                    disabled={!f.targetBeatId}
                    onclick={() => f.targetBeatId && stage.arm(f.targetBeatId)}
                    title={f.label}
                  ><Icon name="fork" size={14} /> {f.label}</button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- ===================== PLAN ===================== -->
    <div class="st-body">
      <!-- left library -->
      <aside class="st-lib">
        <div class="st-sec">
          <div class="st-seclbl">{t('stage.templates')}</div>
          <div class="st-tpls">
            {#each BUILTIN_TEMPLATES as bt (bt.id)}
              <button class="st-tpluse" onclick={() => useBuiltin(bt.nameKey, bt.slots)} title={t('stage.useTemplate')}>
                <span class="st-tplmini">
                  {#each bt.slots.slice(0, 4) as s, i (i)}<span style="background:{kindTint(s.kind)}"></span>{/each}
                </span>
                <span class="st-tplname">{t(bt.nameKey)}</span>
              </button>
            {/each}
            {#each stage.templates as tpl (tpl.id)}
              <div class="st-tpl">
                <button class="st-tpluse grow" onclick={() => stage.addBeatFromTemplate(tpl.id)} title={t('stage.useTemplate')}>
                  <span class="st-tplmini">
                    {#each tpl.slots.slice(0, 4) as s, i (i)}<span style="background:{kindTint(s.kind)}"></span>{/each}
                  </span>
                  <span class="st-tplname">{tpl.name}</span>
                </button>
                <button class="st-tplx" aria-label={t('stage.removeTemplate')} onclick={() => stage.removeTemplate(tpl.id)}><Icon name="close" size={14} /></button>
              </div>
            {/each}
          </div>
          {#if addingTemplate}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="st-inline" autofocus placeholder={t('stage.saveTemplatePrompt')} aria-label={t('stage.saveTemplate')}
              onblur={() => (addingTemplate = false)}
              onkeydown={(e) => { if (e.key === 'Enter') commitTemplate((e.currentTarget as HTMLInputElement).value); else if (e.key === 'Escape') addingTemplate = false; }} />
          {:else}
            <button class="st-add" disabled={stage.tiles.length === 0} onclick={() => (addingTemplate = true)}><Icon name="plus" size={14} /> {t('stage.saveTemplate')}</button>
          {/if}
        </div>

        <div class="st-sec">
          <div class="st-seclbl">{t('stage.cast')}</div>
          <div class="st-hint">{t('stage.dragNpc')}</div>
          <div class="chips">
            {#each npcs.list as n (n.id)}
              <button
                class="srcchip"
                draggable="true"
                ondragstart={(e) => e.dataTransfer?.setData('application/x-stage-npc', n.id)}
                ondblclick={() => stage.addTile('npc', { npcId: n.id })}
                title={g(n.name)}
              >
                {#if n.portraitId && urls[n.portraitId]}<img src={urls[n.portraitId]} alt="" />{:else}<span class="ini">{g(n.name).slice(0, 2).toUpperCase()}</span>{/if}
                <span class="cn">{g(n.name)}</span>
              </button>
            {:else}
              <span class="muted small">—</span>
            {/each}
          </div>
        </div>
      </aside>

      <!-- center stage -->
      <div class="st-center">
        <div class="st-strip">
          <div class="compose">
            <button class="ico" disabled={!stage.canUndo} onclick={() => stage.undo()} title={t('stage.undo')}><Icon name="undo" size={14} /></button>
            <button class="ico" disabled={!stage.canRedo} onclick={() => stage.redo()} title={t('stage.redo')}><Icon name="redo" size={14} /></button>
            <div class="mwrap">
              <button class="btn add" class:on={addMenu} title={t('stage.addHint')}
                onclick={(e) => { e.stopPropagation(); closeGlobalMenus(); addMenu = !addMenu; }}><Icon name="plus" size={14} /> {t('stage.add')}</button>
              {#if addMenu}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="menu" onpointerdown={(e) => e.stopPropagation()}>
                  {#each KINDS as k (k)}<button class="mitem" onclick={() => addKind(k)}>{kindLabel(k)}</button>{/each}
                </div>
              {/if}
            </div>
            <button class="ico" disabled={stage.tiles.length === 0} onclick={() => stage.distribute()} title={t('stage.distributeHint')}><Icon name="grid" size={14} /></button>
          </div>

          <span class="st-editing">{t('stage.editing')} · <b>{stage.active.name}</b> · {variantName}</span>

          <div class="onair">
            <span class="oalbl">{t('stage.onAir').toUpperCase()}</span>
            <button class="btn live" class:on={stage.live} onclick={() => stage.toggleLive()} title={t('stage.live')}>{stage.live ? t('stage.liveOn') : t('stage.liveOff')}</button>
            <button class="btn" disabled={!stage.preview} onclick={() => stage.broadcast()}>{t('stage.toAir')}</button>
            <button class="ico" class:laser={laserOn} onclick={toggleLaser} title={t('stage.laserHint')}><Icon name="laser" size={14} /></button>
            <div class="mwrap">
              <button class="ico" class:on={moodMenu} title={t('stage.mood')} onclick={(e) => { e.stopPropagation(); closeGlobalMenus(); moodMenu = !moodMenu; }}><Icon name="moon" size={14} /></button>
              {#if moodMenu}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="menu right" onpointerdown={(e) => e.stopPropagation()}>
                  <div class="mhdr">{t('stage.mood')}</div>
                  {#each MOODS as m (m.id)}<button class="mitem" class:sel={moodId === m.id} onclick={() => pickMood(m.id)}>{m.label}</button>{/each}
                </div>
              {/if}
            </div>
            <div class="mwrap">
              <button class="ico" class:on={displayMenu} title={t('stage.display')} onclick={(e) => { e.stopPropagation(); closeGlobalMenus(); displayMenu = !displayMenu; }}><Icon name="tile" size={14} /></button>
              {#if displayMenu}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="menu right wide" onpointerdown={(e) => e.stopPropagation()}>
                  <div class="mhdr">{t('stage.displayMode')}</div>
                  <button class="mitem" class:sel={display === 'cinematic'} onclick={() => pickDisplay('cinematic')}>{t('stage.cinematic')}</button>
                  <button class="mitem" class:sel={display === 'plain'} onclick={() => pickDisplay('plain')}>{t('stage.plain')}</button>
                  {#if onairHistory.entries.length}
                    <div class="mhdr">{t('stage.recent')}</div>
                    {#each onairHistory.entries as h (h.id)}<button class="mitem" onclick={() => putOnAir(h.payload)} title={t('stage.reair')}>{describeOnAir(h.payload).label ?? '—'}</button>{/each}
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- board -->
        <div class="boardwrap">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="board"
            class:over={dragOver}
            class:lasermode={laserOn}
            class:variant={stage.activeVariantId !== null}
            bind:this={board}
            style="grid-template-columns: repeat({cols}, 1fr); grid-template-rows: repeat({rows}, 1fr)"
            onpointerenter={() => (hovered = true)}
            onpointermove={boardLaser}
            onpointerleave={() => { hovered = false; if (laserOn) sendLaser(0, 0, false); }}
            ondragover={(e) => { e.preventDefault(); dragOver = true; }}
            ondragleave={() => (dragOver = false)}
            ondrop={onDrop}
          >
            {#each stage.tiles as tl (tl.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="tile edit"
                class:sel={tl.id === stage.selected}
                class:hidden={tl.hidden}
                data-tile={tl.id}
                style="grid-column: {tl.col} / span {tl.cw}; grid-row: {tl.row} / span {tl.rh}{tl.z !== undefined ? `; z-index:${tl.z}` : ''}"
                onpointerdown={(e) => startMove(e, tl)}
                onpointermove={onMove}
                onpointerup={endMove}
                onpointerenter={(e) => { if (tl.kind === 'npc' && tl.npcId && !moving && !resizing) peek?.schedule(e.currentTarget, tl.npcId); }}
                onpointerleave={() => peek?.scheduleClose()}
              >
                <div class="content">{@render tileContent(tl)}</div>
                {#if tl.id === stage.selected}<span class="tcorners"><i></i><i></i><i></i><i></i></span>{/if}
                <button class="rsz" data-control aria-label="resize" onpointerdown={(e) => startResize(e, tl)} onpointermove={onMove} onpointerup={endMove}></button>
              </div>
            {/each}

            {#if stage.tiles.length === 0}
              <div class="empty">
                <div class="emptycard">
                  <div class="emico"><Icon name="plus" size={14} /></div>
                  <div class="emttl">{t('stage.emptyTitle')}</div>
                  <div class="emsub">{t('stage.emptyHint')}</div>
                  <div class="emkinds">
                    {#each KINDS as k (k)}<button class="emkind" onclick={() => addKind(k)}>{kindLabel(k)}</button>{/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- right inspector: variants + forks + player-safety -->
      <aside class="st-insp">
        <div class="st-sec">
          <div class="st-seclbl">{t('stage.thisBeat')}</div>
          <div class="st-variants">
            <button class="st-var" class:on={stage.activeVariantId === null} onclick={() => stage.setActiveVariant(null)}>
              <span class="st-vdot" class:off={stage.activeVariantId !== null}></span>
              <span class="st-vname">{t('stage.baseVariant')}</span>
              <span class="st-vbadge">BASE</span>
            </button>
            {#each stage.active.variants as v (v.id)}
              <div class="st-varrow" class:on={stage.activeVariantId === v.id}>
                {#if editingVariant === v.id}
                  <!-- svelte-ignore a11y_autofocus -->
                  <input class="st-vedit" value={v.name} autofocus aria-label={t('stage.variantName')}
                    onblur={(e) => { stage.renameVariant(v.id, (e.currentTarget as HTMLInputElement).value.trim() || v.name); editingVariant = null; }}
                    onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); else if (e.key === 'Escape') editingVariant = null; }} />
                {:else}
                  <button class="st-var grow" onclick={() => stage.setActiveVariant(v.id)} ondblclick={() => (editingVariant = v.id)}>
                    <span class="st-vdot" class:off={stage.activeVariantId !== v.id}></span>
                    <span class="st-vname">{v.name}</span>
                    <span class="st-vbadge">Δ {Object.keys(v.patches).length + v.added.length + v.removed.length}</span>
                  </button>
                  <button class="st-vx" aria-label={t('stage.removeVariant')} onclick={() => stage.removeVariant(v.id)}><Icon name="close" size={14} /></button>
                {/if}
              </div>
            {/each}
          </div>
          {#if addingVariant}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="st-inline" autofocus placeholder={t('stage.newVariantPrompt')} aria-label={t('stage.newVariant')}
              onblur={() => (addingVariant = false)}
              onkeydown={(e) => { if (e.key === 'Enter') commitVariant((e.currentTarget as HTMLInputElement).value); else if (e.key === 'Escape') addingVariant = false; }} />
          {:else}
            <button class="st-add" onclick={() => (addingVariant = true)}><Icon name="plus" size={14} /> {t('stage.newVariant')}</button>
          {/if}
          {#if stage.activeVariantId !== null}<div class="st-hint gold">{t('stage.variantEditing')}</div>{/if}
        </div>

        <div class="st-sec">
          <div class="st-seclbl">{t('stage.forks')}</div>
          {#each stage.active.forks as f (f.id)}
            <div class="st-fork">
              <div class="st-forkhd">
                {#if editingFork === f.id}
                  <!-- svelte-ignore a11y_autofocus -->
                  <input class="st-vedit grow" value={f.label} autofocus aria-label={t('stage.forkLabel')}
                    onblur={(e) => { stage.updateFork(stage.active.id, f.id, { label: (e.currentTarget as HTMLInputElement).value.trim() || f.label }); editingFork = null; }}
                    onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); else if (e.key === 'Escape') editingFork = null; }} />
                {:else}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span class="st-forklbl" ondblclick={() => (editingFork = f.id)}><Icon name="fork" size={14} /> {f.label}</span>
                {/if}
                <button class="st-vx" aria-label={t('stage.removeFork')} onclick={() => stage.removeFork(stage.active.id, f.id)}><Icon name="close" size={14} /></button>
              </div>
              <select class="st-forksel" value={f.targetBeatId ?? ''} onchange={(e) => stage.updateFork(stage.active.id, f.id, { targetBeatId: (e.currentTarget as HTMLSelectElement).value || undefined })}>
                <option value="">{t('stage.forkTarget')}</option>
                {#each stage.beats.filter((b) => b.id !== stage.active.id) as b (b.id)}<option value={b.id}>→ {b.name}</option>{/each}
              </select>
            </div>
          {/each}
          {#if addingFork}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="st-inline" autofocus placeholder={t('stage.newForkPrompt')} aria-label={t('stage.newFork')}
              onblur={() => (addingFork = false)}
              onkeydown={(e) => { if (e.key === 'Enter') commitFork((e.currentTarget as HTMLInputElement).value); else if (e.key === 'Escape') addingFork = false; }} />
          {:else}
            <button class="st-add" onclick={() => (addingFork = true)}><Icon name="plus" size={14} /> {t('stage.newFork')}</button>
          {/if}
        </div>

        <div class="st-safety">
          <div class="st-safelbl">{t('stage.playerSafety')}</div>
          <div class="st-safebody">{t('stage.playerSafetyBody')}</div>
        </div>
      </aside>
    </div>

    <!-- rundown (PLAN) -->
    <div class="st-rundown">
      <div class="st-rhd">
        <span class="st-rlbl">{t('stage.rundown')}</span>
        <span class="st-rhint">{t('stage.rundownHint')}</span>
        <button class="st-radd" onclick={() => stage.addBeat()}><Icon name="plus" size={14} /> {t('stage.addBeat')}</button>
      </div>
      <div class="st-spine">
        {#each stage.beats as b, i (b.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="st-beatwrap" class:dropbefore={dropIndex === i} ondragover={(e) => { e.preventDefault(); dropIndex = i; }} ondrop={() => beatDrop(i)}>
            <div class="st-beat" class:cur={b.id === stage.cursorId} role="button" tabindex="0"
              draggable={editingBeat !== b.id}
              ondragstart={() => (dragBeat = b.id)}
              ondragend={() => { dragBeat = null; dropIndex = null; }}
              onclick={() => stage.setCursor(b.id)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') stage.setCursor(b.id); }}
            >
              <div class="st-brow">
                <span class="st-bnum">{String(i + 1).padStart(2, '0')}</span>
                {#if b.forks.length}<span class="st-bfork"><Icon name="fork" size={14} /> {b.forks.length}</span>{/if}
                {#if b.variants.length}<span class="st-bvar">×{b.variants.length + 1}</span>{/if}
              </div>
              {#if editingBeat === b.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input class="st-bedit" value={b.name} autofocus aria-label={t('stage.beatName')}
                  onclick={(e) => e.stopPropagation()}
                  onblur={(e) => { stage.renameBeat(b.id, (e.currentTarget as HTMLInputElement).value.trim() || b.name); editingBeat = null; }}
                  onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); else if (e.key === 'Escape') editingBeat = null; }} />
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="st-bname" ondblclick={(e) => { e.stopPropagation(); editingBeat = b.id; }}>{b.name}</div>
              {/if}
              <div class="st-bmini">
                {#each b.tiles.slice(0, 5) as tl (tl.id)}<span class="st-swatch" style="background:{kindTint(tl.kind)}"></span>{/each}
              </div>
              {#if b.id === stage.cursorId}
                <div class="st-bactions">
                  <button class="st-baction" onclick={(e) => { e.stopPropagation(); stage.duplicateBeat(b.id); }} title={t('stage.duplicateBeat')}><Icon name="duplicate" size={14} /></button>
                  <button class="st-baction danger" disabled={stage.beats.length <= 1} onclick={(e) => { e.stopPropagation(); stage.removeBeat(b.id); }} title={t('stage.deleteBeat')}><Icon name="close" size={14} /></button>
                </div>
              {/if}
            </div>
          </div>
        {/each}
        <button class="st-newbeat" onclick={() => stage.addBeat()} title={t('stage.addBeat')} aria-label={t('stage.addBeat')}><Icon name="plus" size={16} /></button>
      </div>
    </div>
  {/if}

  <NpcPeek bind:this={peek} onPickImage={pickBroadcastImage} />
</div>

<!-- Floating action bar — anchored above the selected tile (PLAN only). -->
{#if sel && anchor && stage.mode === 'plan'}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="abar" style={barStyle} onpointerdown={(e) => e.stopPropagation()}>
    <button class="ab" class:on={editOpen} onclick={() => (editOpen = !editOpen)}>{t('stage.edit')}</button>
    <div class="mwrap">
      <button class="ab" class:on={kindMenu} onclick={(e) => { e.stopPropagation(); closeTileMenus(); kindMenu = !kindMenu; }}>{t('stage.kind')}</button>
      {#if kindMenu}
        <div class="menu">
          {#each KINDS as k (k)}<button class="mitem" class:sel={sel.kind === k} onclick={() => { stage.patchTile(sel.id, { kind: k }); kindMenu = false; }}>{kindLabel(k)}</button>{/each}
        </div>
      {/if}
    </div>
    <button class="ab" onclick={() => stage.spotlight(sel.id)} title={t('stage.spotlightHint')}>{t('stage.spotlight')}</button>
    <button class="ab" title={sel.hidden ? t('stage.show') : t('stage.hide')} onclick={() => stage.toggleHidden(sel.id)}>{sel.hidden ? t('stage.showShort') : t('stage.hideShort')}</button>
    <div class="mwrap">
      <button class="ab" class:on={layerMenu} onclick={(e) => { e.stopPropagation(); closeTileMenus(); layerMenu = !layerMenu; }}>{t('stage.layer')}</button>
      {#if layerMenu}
        <div class="menu">
          <button class="mitem" onclick={() => { stage.bringToFront(sel.id); layerMenu = false; }}>{t('stage.front')}</button>
          <button class="mitem" onclick={() => { stage.sendToBack(sel.id); layerMenu = false; }}>{t('stage.back')}</button>
        </div>
      {/if}
    </div>
    <button class="ab" onclick={() => stage.duplicateTile(sel.id)}>{t('stage.duplicate')}</button>
    <button class="ab danger" onclick={() => stage.removeTile(sel.id)}>{t('stage.delete')}</button>
  </div>

  {#if editOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pop" style={popStyle} onpointerdown={(e) => e.stopPropagation()}>
      <div class="pophd">
        <span>{t('stage.edit').toUpperCase()} · {kindLabel(sel.kind)}</span>
        <button class="ico xs" aria-label={t('stage.close')} onclick={() => (editOpen = false)}><Icon name="close" size={14} /></button>
      </div>

      {#if sel.kind === 'image'}
        <div class="fld">
          <span class="flbl">{t('stage.source')}</span>
          <div class="frow">
            <label class="btn sm">{t('stage.chooseImage')}<input type="file" accept="image/*" hidden onchange={(e) => pickImage(e, sel.id)} /></label>
            <input class="in grow" placeholder={t('stage.imageUrlPlaceholder')} value={sel.src ?? ''} oninput={(e) => stage.patchTile(sel.id, { src: (e.currentTarget as HTMLInputElement).value || undefined })} />
          </div>
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.captionPlaceholder')}</span>
          <input class="in" placeholder={t('stage.captionPlaceholder')} value={sel.caption ?? ''} oninput={(e) => stage.patchTile(sel.id, { caption: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.reveal')}</span>
          <div class="seg">
            {#each [['', 'revealNone'], ['blur', 'revealBlur'], ['panh', 'revealPanH'], ['panv', 'revealPanV']] as [val, key] (key)}
              <button class:on={(sel.reveal ?? '') === val} onclick={() => stage.patchTile(sel.id, { reveal: (val || undefined) as Tile['reveal'] })}>{t('stage.' + key)}</button>
            {/each}
          </div>
        </div>
      {:else if sel.kind === 'text'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input class="in" placeholder={t('stage.titlePlaceholder')} value={sel.title ?? ''} oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.bodyPlaceholder')}</span>
          <input class="in" placeholder={t('stage.bodyPlaceholder')} value={sel.body ?? ''} oninput={(e) => stage.patchTile(sel.id, { body: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.theme')}</span>
          <div class="seg">
            {#each [['', 'themeNone'], ['parchment', 'themeParchment'], ['letter', 'themeLetter'], ['telegram', 'themeTelegram']] as [val, key] (key)}
              <button class:on={(sel.theme ?? '') === val} onclick={() => stage.patchTile(sel.id, { theme: (val || undefined) as Tile['theme'] })}>{t('stage.' + key)}</button>
            {/each}
          </div>
        </div>
      {:else if sel.kind === 'clock'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input class="in" placeholder={t('stage.titlePlaceholder')} value={sel.title ?? ''} oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.seconds')}</span>
          <input class="in" type="number" min="0" value={sel.seconds ?? 60} oninput={(e) => stage.patchTile(sel.id, { seconds: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })} />
        </div>
      {:else if sel.kind === 'date'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input class="in" placeholder={t('stage.titlePlaceholder')} value={sel.title ?? ''} oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </div>
        <button class="btn sm" onclick={() => refreshDate(sel)}>{t('stage.refreshDate')}</button>
      {:else}
        <div class="fld">
          <span class="flbl">{t('stage.pickNpc')}</span>
          <select class="in" value={sel.npcId ?? ''} onchange={(e) => stage.patchTile(sel.id, { npcId: (e.currentTarget as HTMLSelectElement).value || undefined })}>
            <option value="">{t('stage.pickNpc')}</option>
            {#each npcs.list as n (n.id)}<option value={n.id}>{g(n.name)}</option>{/each}
          </select>
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 6px;
    overflow: hidden;
  }

  /* top bar */
  .st-top {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 12px;
    border-radius: var(--r2) var(--r2) 0 0;
    background: var(--bg1);
    border: 1px solid var(--line2);
  }
  .st-wm {
    font-family: var(--serif);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.16em;
    color: var(--gold);
  }
  .st-modes {
    display: flex;
    gap: 3px;
    padding: 3px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
  }
  .st-mode {
    padding: 5px 16px;
    border: 0;
    border-radius: var(--r1);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
  }
  .st-mode.on {
    /* segmented-control selection, not on-air: green per gold-rule */
    background: var(--green-dim);
    color: var(--ink);
  }
  .st-sess {
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
    color: var(--txt);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-moods {
    display: flex;
    gap: 5px;
  }
  .st-moodchip {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    padding: 0;
  }
  .st-moodchip.on {
    /* mood preset selection, not on-air: green per gold-rule */
    border-color: var(--focus);
    box-shadow: 0 0 0 2px var(--fill-g22);
  }
  .st-topright {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .st-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .st-status i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--line2);
  }
  .st-status.live {
    color: var(--gold);
  }
  .st-status.live i {
    background: var(--gold);
    box-shadow: 0 0 8px var(--gold);
  }

  /* body: library · center · inspector */
  .st-body {
    flex: 1;
    display: flex;
    gap: 8px;
    min-height: 0;
  }
  .st-lib,
  .st-insp {
    flex: 0 0 auto;
    width: 178px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: auto;
    padding: 2px;
  }
  .st-sec {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .st-seclbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .st-hint {
    font-size: 10px;
    line-height: 1.4;
    color: var(--faint);
  }
  .st-hint.gold {
    color: var(--gold);
  }

  /* templates */
  .st-tpls {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .st-tpl {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .st-tpluse {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 7px;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    text-align: left;
    width: 100%;
  }
  .st-tpluse:hover {
    border-color: var(--green-dim);
  }
  .st-tpluse.grow {
    flex: 1;
    min-width: 0;
    width: auto;
  }
  .st-tplmini {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    width: 22px;
    height: 16px;
  }
  .st-tplmini span {
    border-radius: 1px;
  }
  .st-tplname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-tplx,
  .st-vx {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .st-tplx:hover,
  .st-vx:hover {
    color: var(--red);
  }
  .st-add {
    /* decorative action accent, not on-air: green per gold-rule */
    border: 0;
    background: transparent;
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    padding: 2px 0;
  }
  .st-add:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .st-inline {
    /* active inline-edit field, not on-air: focus-green border per gold-rule */
    box-sizing: border-box;
    width: 100%;
    padding: 6px 8px;
    font: inherit;
    font-size: 11px;
    background: var(--bg1);
    color: var(--txt);
    border: 1px solid var(--focus);
    border-radius: var(--r2);
  }
  .st-inline::placeholder {
    color: var(--faint);
  }

  /* inspector — variants + forks + safety */
  .st-variants {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .st-var {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    width: 100%;
    text-align: left;
  }
  .st-var:hover {
    border-color: var(--green-dim);
  }
  .st-var.on {
    /* variant selection (PLAN-time, not on-air): green per gold-rule */
    border-color: var(--focus);
    background: var(--fill-g14);
  }
  .st-varrow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .st-varrow.on .st-var {
    border-color: var(--focus);
    background: var(--fill-g14);
  }
  .st-var.grow {
    flex: 1;
    min-width: 0;
  }
  .st-vdot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--green);
  }
  .st-vdot.off {
    background: transparent;
    border: 1px solid var(--muted);
  }
  .st-vname {
    font-size: 11px;
    color: var(--txt);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-vbadge {
    margin-left: auto;
    font-size: 9px;
    color: var(--muted);
  }
  .st-vedit {
    box-sizing: border-box;
    width: 100%;
    padding: 5px 7px;
    font: inherit;
    font-size: 11px;
    background: var(--bg1);
    color: var(--txt);
    border: 1px solid var(--focus);
    border-radius: var(--r2);
  }
  .st-vedit.grow {
    flex: 1;
    min-width: 0;
  }
  .st-fork {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 8px;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
  }
  .st-forkhd {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .st-forklbl {
    /* decorative label, not on-air: green per gold-rule */
    flex: 1;
    min-width: 0;
    font-size: 11px;
    color: var(--green);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .st-forksel {
    box-sizing: border-box;
    width: 100%;
    padding: 4px 6px;
    font: inherit;
    font-size: 10px;
    border-radius: var(--r1);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--muted);
  }
  .st-safety {
    /* player-safety callout: kept gold (ambiguous, not a selection state; see receipt) */
    margin-top: auto;
    padding: 10px;
    border: 1px solid var(--edge-gold);
    border-radius: var(--r2);
    background: var(--fill-gold);
  }
  .st-safelbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 4px;
  }
  .st-safebody {
    font-size: 10px;
    line-height: 1.5;
    color: var(--muted);
  }

  /* center */
  .st-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .st-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .st-editing {
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--faint);
  }
  .st-editing b {
    color: var(--muted);
  }

  /* ===================== RUN cockpit ===================== */
  .st-cockpit {
    flex: 1;
    display: flex;
    align-items: stretch;
    gap: 16px;
    min-height: 0;
    padding: 6px 4px;
  }
  .st-air,
  .st-preview {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .st-airlbl,
  .st-prevlbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
  }
  .st-airlbl {
    color: var(--gold);
  }
  .st-prevhd {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .st-prevlbl {
    color: var(--green);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-vcycle {
    margin-left: auto;
    border: 1px solid var(--green-dim);
    border-radius: var(--r1);
    background: var(--fill-g08);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    padding: 3px 8px;
    white-space: nowrap;
  }
  .st-frame {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
  }
  .st-mini {
    position: relative;
    width: 100%;
    aspect-ratio: 1280 / 800;
    max-height: 100%;
    display: grid;
    gap: 0;
    border-radius: var(--r1);
    overflow: hidden;
    background: var(--bg1);
  }
  .st-frame.air .st-mini {
    /* genuinely on-air (AIR frame): keep gold */
    border: 2px solid var(--gold);
    box-shadow: 0 0 26px var(--fill-gold);
  }
  .st-frame.prev .st-mini {
    /* preview/armed frame, not on-air: green per gold-rule */
    border: 1.5px solid var(--green-dim);
  }
  .st-miniempty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 11px;
    color: var(--faint);
  }
  .st-framemeta {
    font-size: 10px;
    color: var(--faint);
  }
  .st-takecol {
    flex: 0 0 auto;
    width: 128px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .st-take {
    /* genuinely on-air action (TAKE pushes to broadcast): keep gold */
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 0;
    background: radial-gradient(circle at 38% 30%, var(--gold-hi), var(--gold) 58%, #8f7135);
    color: var(--gold-ink);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px var(--fill-gold);
  }
  .st-take:disabled {
    opacity: 0.4;
    cursor: default;
    box-shadow: none;
  }
  .st-taketxt {
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.14em;
  }
  .st-takekey {
    font-size: 9px;
    opacity: 0.75;
    margin-top: 2px;
  }
  .st-liveedit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .st-lelbl {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: var(--faint);
  }
  .st-toggle {
    width: 38px;
    height: 20px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface3);
    cursor: pointer;
    padding: 0;
    position: relative;
  }
  .st-toggle i {
    position: absolute;
    left: 3px;
    top: 2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--faint);
    transition: transform 0.12s;
  }
  .st-toggle.on {
    /* live-edit-to-air toggle: on-air-adjacent, keep gold */
    border-color: var(--gold);
    background: rgba(214, 182, 94, 0.25);
  }
  .st-toggle.on i {
    transform: translateX(17px);
    background: var(--gold);
  }
  .st-lehint {
    font-size: 8.5px;
    line-height: 1.3;
    color: var(--faint);
    text-align: center;
  }

  /* rundown */
  .st-rundown {
    border-top: 1px solid var(--fill-gold);
    padding: 10px 6px 4px;
  }
  .st-rhd {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .st-rlbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .st-rhint {
    font-size: 10px;
    color: var(--faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-radd {
    /* decorative action accent, not on-air: green per gold-rule */
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
  }
  .st-spine {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .st-beatwrap,
  .st-runbeatwrap {
    position: relative;
    flex: 0 0 auto;
  }
  .st-runbeatwrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .st-beatwrap.dropbefore::before {
    /* drag drop-target indicator, not on-air: green per gold-rule */
    content: '';
    position: absolute;
    left: -6px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--green);
    border-radius: 1px;
  }
  .st-beat {
    position: relative;
    width: 132px;
    min-height: 84px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    box-sizing: border-box;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
    cursor: grab;
  }
  .st-beat.cur {
    /* cursor beat (PLAN-time selection, not on-air): green per gold-rule */
    border-color: var(--focus);
    background: var(--fill-g14);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  .st-runbeat {
    width: 118px;
    min-height: 58px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 9px;
    box-sizing: border-box;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    text-align: left;
  }
  .st-runbeat:hover {
    border-color: var(--green-dim);
  }
  .st-runbeat.aired {
    /* genuinely on-air (this beat is currently aired): keep gold */
    border-color: var(--gold);
    background: var(--fill-gold);
    box-shadow: 0 0 18px var(--fill-gold);
  }
  .st-runbeat.armed {
    /* armed/next beat, not yet on-air: dashed green per gold-rule */
    border-color: var(--green);
    border-style: dashed;
  }
  .st-brow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .st-bnum {
    font-size: 9px;
    font-family: ui-monospace, monospace;
    color: var(--muted);
  }
  .st-bfork {
    font-size: 8.5px;
    color: var(--muted);
  }
  .st-bvar {
    /* decorative badge, not on-air: green per gold-rule */
    margin-left: auto;
    font-size: 8.5px;
    color: var(--green);
  }
  .st-barmed {
    /* armed/next indicator, not on-air: green per gold-rule */
    margin-left: auto;
    font-size: 8px;
    color: var(--green);
    letter-spacing: 0.08em;
  }
  .st-bname {
    font-family: var(--serif);
    font-size: 13px;
    color: var(--txt);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-bedit {
    /* active inline-edit field, not on-air: focus-green per gold-rule */
    width: 100%;
    box-sizing: border-box;
    padding: 2px 5px;
    font: inherit;
    font-size: 12px;
    background: var(--bg1);
    color: var(--txt);
    border: 1px solid var(--focus);
    border-radius: var(--r1);
  }
  .st-bmini {
    display: flex;
    gap: 3px;
    margin-top: auto;
  }
  .st-swatch {
    width: 18px;
    height: 12px;
    border-radius: 2px;
  }
  .st-bactions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 2px;
  }
  .st-baction {
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: var(--r1);
    background: var(--bg1);
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
  }
  .st-baction:hover:not(:disabled) {
    background: var(--fill-g22);
    color: var(--txt);
  }
  .st-baction.danger:hover:not(:disabled) {
    background: var(--fill-red);
    color: #fff;
  }
  .st-baction:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .st-forkchips {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 118px;
  }
  .st-forkchip {
    border: 1px solid var(--line2);
    border-radius: var(--r1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 9px;
    padding: 4px 7px;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st-forkchip:hover:not(:disabled) {
    /* armed-target hover, not on-air: green per gold-rule */
    border-color: var(--green);
    color: var(--green);
  }
  .st-forkchip.armed {
    /* fork is the armed target, not on-air: green per gold-rule */
    border-color: var(--green);
    color: var(--green);
    background: var(--fill-g14);
  }
  .st-forkchip:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .st-newbeat {
    flex: 0 0 auto;
    width: 132px;
    align-self: stretch;
    border: 1px dashed var(--line2);
    border-radius: var(--r2);
    background: transparent;
    color: var(--green-dim);
    cursor: pointer;
    font-size: 20px;
  }
  .st-newbeat:hover {
    border-color: var(--green-dim);
    color: var(--green);
  }

  /* --- reused board chrome ------------------------------------------------- */
  .compose {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .onair {
    /* genuinely the on-air control cluster: keep gold */
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 7px;
    border: 1px solid var(--gold);
    border-radius: var(--r2);
    background: rgba(214, 182, 94, 0.06);
  }
  .oalbl {
    font-size: 9px;
    letter-spacing: 0.16em;
    color: var(--gold);
    margin-right: 2px;
  }
  .btn {
    padding: 5px 10px;
    font-size: 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    background: var(--fill-g14);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-color: var(--green-dim);
    color: var(--green);
    font-weight: 600;
  }
  .btn.live.on {
    /* live-edit-to-air toggle: on-air-adjacent, keep gold */
    border-color: var(--gold);
    background: var(--gold);
    color: var(--gold-ink);
    font-weight: 700;
  }
  .btn.panic:hover {
    border-color: var(--red-dim);
    color: var(--red);
    background: var(--fill-red);
  }
  .btn.sm {
    padding: 4px 8px;
    font-size: 11px;
  }
  .ico {
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
  }
  .ico:hover:not(:disabled) {
    background: var(--fill-g14);
  }
  .ico:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ico.on {
    /* menu-open toggle state, not on-air: green per gold-rule */
    border-color: var(--focus);
    color: var(--green);
    background: var(--fill-g14);
  }
  .ico.laser {
    border-color: #ff5a5a;
    background: rgba(255, 45, 45, 0.18);
    color: #ff8a8a;
  }
  .ico.xs {
    min-width: 20px;
    height: 20px;
    font-size: 11px;
  }
  .mwrap {
    position: relative;
    display: inline-flex;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 40;
    min-width: 150px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
  }
  .menu.right {
    left: auto;
    right: 0;
  }
  .menu.wide {
    min-width: 200px;
  }
  .mhdr {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    padding: 4px 6px 2px;
  }
  .mitem {
    text-align: left;
    height: var(--menu-item);
    padding: 0 10px;
    border: 0;
    border-radius: var(--r1);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mitem:hover:not(:disabled) {
    background: var(--fill-g14);
  }
  .mitem.sel {
    /* selected menu item (mood/display pick, not on-air): green per gold-rule */
    color: var(--green);
    background: var(--fill-g14);
  }
  .chips {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .srcchip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 5px;
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    background: var(--surface2);
    color: var(--txt);
    cursor: grab;
    font: inherit;
    font-size: 12px;
    text-align: left;
  }
  .srcchip:hover {
    border-color: var(--green-dim);
  }
  .srcchip img,
  .srcchip .ini {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border-radius: var(--r1);
    object-fit: cover;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.3);
    font-size: 9px;
    color: var(--green);
  }
  .srcchip .cn {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .boardwrap {
    flex: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .board {
    position: relative;
    width: 100%;
    aspect-ratio: 1280 / 800;
    max-height: 100%;
    display: grid;
    gap: 0;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background-color: var(--bg1);
    background-image: radial-gradient(rgba(214, 182, 94, 0.13) 1px, transparent 1.6px);
    background-size: calc(100% / 12) calc(100% / 8);
    background-position: calc(100% / 24) calc(100% / 16);
    touch-action: none;
    overflow: hidden;
  }
  .board.over {
    border-color: var(--green);
    box-shadow: inset 0 0 0 2px var(--fill-g22);
  }
  .board.variant {
    /* editing a variant on the board (not on-air): green per gold-rule */
    border-color: var(--focus);
    box-shadow: inset 0 0 0 1px var(--fill-g14);
  }
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .emptycard {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 26px 34px;
    border: 1px dashed var(--line2);
    border-radius: var(--r4);
    text-align: center;
  }
  .emico {
    font-size: 30px;
    color: var(--green-dim);
  }
  .emttl {
    font-family: var(--serif);
    font-size: 17px;
    color: var(--txt);
  }
  .emsub {
    font-size: 11px;
    color: var(--faint);
  }
  .emkinds {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .emkind {
    padding: 4px 12px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .emkind:hover {
    border-color: var(--green-dim);
    background: var(--fill-g14);
  }

  /* tiles (shared by editable board + mini boards) */
  .tile {
    position: relative;
    min-width: 0;
    min-height: 0;
    border: 1px solid transparent;
    background: var(--surface2);
    overflow: hidden;
  }
  .tile.edit {
    cursor: move;
  }
  .tile.sel {
    /* selected tile (PLAN-time selection, not on-air): green per gold-rule */
    border-color: var(--focus);
    z-index: 2;
  }
  /* green targeting-frame corners on the selected tile (was gold; selection, not on-air). */
  .tcorners i {
    position: absolute;
    width: 7px;
    height: 7px;
    background: var(--focus);
    z-index: 3;
    pointer-events: none;
  }
  .tcorners i:nth-child(1) {
    left: 0;
    top: 0;
  }
  .tcorners i:nth-child(2) {
    right: 0;
    top: 0;
  }
  .tcorners i:nth-child(3) {
    left: 0;
    bottom: 0;
  }
  .tcorners i:nth-child(4) {
    right: 0;
    bottom: 0;
  }
  .tile.hidden {
    opacity: 0.4;
  }
  .tile.hidden::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 6px,
      rgba(0, 0, 0, 0.25) 6px,
      rgba(0, 0, 0, 0.25) 12px
    );
    pointer-events: none;
  }
  .content {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .timg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tcap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 6px 12px;
    background: rgba(6, 10, 7, 0.85);
    color: #d8d2c0;
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ttext {
    padding: 6px 8px;
    text-align: center;
    color: var(--txt);
    overflow: hidden;
  }
  .ttext strong {
    display: block;
    font-family: var(--serif);
    color: var(--gold);
    font-size: 15px;
    letter-spacing: 0.01em;
    margin-bottom: 4px;
  }
  .ttext span {
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
  .ttext.parchment,
  .ttext.letter,
  .ttext.telegram {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding: 6px 10px;
    border-radius: 4px;
    text-align: left;
  }
  .ttext.parchment {
    background: linear-gradient(#efe2c0, #e3d2a6);
    border: 1px solid #b39a63;
  }
  .ttext.parchment strong {
    font-family: var(--serif);
    color: #5a3b1c;
  }
  .ttext.parchment span {
    color: #3a2c14;
  }
  .ttext.letter {
    background: linear-gradient(175deg, #d8cdb2, #c8bc9e);
    border: 1px solid #b7ab8c;
  }
  .ttext.letter strong {
    font-family: var(--serif);
    font-size: 14px;
    letter-spacing: 0.02em;
    color: #3a3226;
  }
  .ttext.letter span {
    font-family: var(--serif);
    font-style: italic;
    line-height: 1.55;
    color: #4a4030;
  }
  .ttext.telegram {
    background: #f0ead6;
    border: 1px dashed #7a6a3a;
    text-align: center;
  }
  .ttext.telegram strong,
  .ttext.telegram span {
    font-family: 'Courier New', monospace;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #1a1a1a;
  }
  .ph {
    color: var(--faint);
    font-size: 11px;
    text-align: center;
    padding: 6px;
  }
  .tmeta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    text-align: center;
    overflow: hidden;
  }
  .tmlbl {
    color: var(--muted);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .tmbig {
    font-family: var(--serif);
    color: var(--gold);
    font-size: 27px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tmmid {
    font-family: var(--serif);
    color: var(--txt);
    font-size: 16px;
    letter-spacing: 0.01em;
  }
  .tmoon {
    color: var(--faint);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .ttime {
    color: var(--faint);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  }
  .rsz {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: linear-gradient(135deg, transparent 50%, var(--gold) 50%);
    cursor: nwse-resize;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tile:hover .rsz,
  .tile.sel .rsz {
    opacity: 0.85;
  }

  /* floating action bar + popover */
  .abar {
    position: fixed;
    z-index: 60;
    transform: translateY(-100%);
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
  }
  .ab {
    padding: 4px 8px;
    border: 0;
    border-radius: var(--r1);
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    white-space: nowrap;
  }
  .ab:hover {
    background: var(--fill-g14);
  }
  .ab.on {
    /* floating-bar menu-open toggle, not on-air: green per gold-rule */
    color: var(--green);
    background: var(--fill-g14);
  }
  .ab.danger:hover {
    background: var(--fill-red);
    color: var(--red);
  }
  .pop {
    position: fixed;
    z-index: 60;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: var(--r3);
    border: 1px solid var(--line2);
    background: var(--menu-bg);
    box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(10px);
  }
  .pophd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .frow {
    display: flex;
    gap: 5px;
  }
  .flbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .in {
    box-sizing: border-box;
    width: 100%;
    padding: 5px 7px;
    font: inherit;
    font-size: 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
  }
  .seg button {
    padding: 4px 9px;
    border: 1px solid var(--line2);
    border-left-width: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .seg button:first-child {
    border-left-width: 1px;
    border-radius: var(--r2) 0 0 var(--r2);
  }
  .seg button:last-child {
    border-radius: 0 var(--r2) var(--r2) 0;
  }
  .seg button.on {
    /* segmented-control selection, not on-air: already green per gold-rule */
    background: var(--fill-g14);
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 11px;
  }
</style>
