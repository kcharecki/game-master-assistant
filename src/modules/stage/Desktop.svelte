<script lang="ts">
  import { onMount } from 'svelte';
  import { stage, type Tile, type TileKind } from './store.svelte';
  import { formatCountdown } from './board';
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
  // Laser pointer mode: while on, cursor over the board drives a live dot on air.
  let laserOn = $state(false);
  let lastLaser = 0;

  // --- v2 chrome state ------------------------------------------------------
  // The board is the interface: global menus + a per-tile action bar / editor
  // that only appear on contact. Booleans below drive those transient popovers.
  let addMenu = $state(false);
  let moodMenu = $state(false);
  let displayMenu = $state(false);
  let presetMenu = $state(false);
  let kindMenu = $state(false); // action-bar: swap tile kind
  let layerMenu = $state(false); // action-bar: front/back
  let editOpen = $state(false); // per-tile Edit popover
  let drawerOpen = $state(true); // NPC source drawer

  function closeGlobalMenus() {
    addMenu = moodMenu = displayMenu = presetMenu = false;
  }
  function closeTileMenus() {
    kindMenu = layerMenu = false;
  }
  function closeAllMenus() {
    closeGlobalMenus();
    closeTileMenus();
  }

  // --- GM-only NPC peek (never broadcast) -----------------------------------
  let peek: ReturnType<typeof NpcPeek> | undefined;
  function pickBroadcastImage(assetId: string, id: string) {
    npcs.setPrimaryPhoto(id, assetId);
    if (stage.live) stage.broadcast();
  }

  const cols = $derived(stage.active.cols);
  const rows = $derived(stage.active.rows);
  const sel = $derived(stage.tiles.find((tl) => tl.id === stage.selected) ?? null);

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

  // Reset per-tile chrome whenever the selection changes; re-anchor to the tile.
  $effect(() => {
    void stage.selected;
    editOpen = false;
    closeTileMenus();
    queueMicrotask(syncAnchor);
  });

  // --- asset URL resolution (image tiles + npc portraits + rail) ------------
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    for (const tl of stage.tiles) {
      if (tl.kind === 'image' && tl.assetId) want.add(tl.assetId);
      if (tl.kind === 'npc' && tl.npcId) {
        const p = stage.npcLookup(tl.npcId);
        if (p?.portraitId) want.add(p.portraitId);
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

  // --- selected-tile anchor (fixed overlay follows the tile's DOM rect) ------
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
  // Action bar sits just above the tile; the Edit popover flips to whichever
  // side has room. Both are position:fixed off the live tile rect.
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

  // --- tile resize ----------------------------------------------------------
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
  function handleKey(e: KeyboardEvent) {
    if (!hovered || !stage.selected) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
  function savePreset() {
    const name = prompt(t('stage.savePresetPrompt'));
    if (name?.trim()) stage.savePreset(name.trim());
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

  // --- scene tab rename -----------------------------------------------------
  let editingScene = $state<string | null>(null);
</script>

<div class="stage">
  <!-- title strip -->
  <div class="titlebar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="ttl">{t('stage.board').toUpperCase()} · {stage.active.name}</span>
  </div>

  <!-- control strip: compose (left) · on-air cluster (right, boxed) -->
  <div class="strip">
    <div class="compose">
      <button class="ico" disabled={!stage.canUndo} onclick={() => stage.undo()} title={t('stage.undo')}
        >↺</button
      >
      <button class="ico" disabled={!stage.canRedo} onclick={() => stage.redo()} title={t('stage.redo')}
        >↷</button
      >
      <div class="mwrap">
        <button
          class="btn add"
          class:on={addMenu}
          title={t('stage.addHint')}
          onclick={(e) => {
            e.stopPropagation();
            closeGlobalMenus();
            addMenu = !addMenu;
          }}><Icon name="plus" /> {t('stage.add')}</button
        >
        {#if addMenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="menu" onpointerdown={(e) => e.stopPropagation()}>
            {#each KINDS as k (k)}
              <button class="mitem" onclick={() => addKind(k)}>{kindLabel(k)}</button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="onair">
      <span class="oalbl">{t('stage.onAir').toUpperCase()}</span>
      <button class="btn live" class:on={stage.live} onclick={() => stage.toggleLive()} title={t('stage.live')}
        >{stage.live ? t('stage.liveOn') : t('stage.liveOff')}</button
      >
      <button class="btn" disabled={!stage.preview} onclick={() => stage.broadcast()}>{t('stage.toAir')}</button>
      <button class="btn panic" onclick={() => clearBroadcast()} title={t('onair.panicTitle')}
        >{t('stage.panic')}</button
      >
      <button class="ico" class:laser={laserOn} onclick={toggleLaser} title={t('stage.laserHint')}>✦</button>
      <div class="mwrap">
        <button
          class="ico"
          class:on={moodMenu}
          title={t('stage.mood')}
          onclick={(e) => {
            e.stopPropagation();
            closeGlobalMenus();
            moodMenu = !moodMenu;
          }}>☾</button
        >
        {#if moodMenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="menu right" onpointerdown={(e) => e.stopPropagation()}>
            <div class="mhdr">{t('stage.mood')}</div>
            {#each MOODS as m (m.id)}
              <button class="mitem" class:sel={moodId === m.id} onclick={() => pickMood(m.id)}>{m.label}</button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="mwrap">
        <button
          class="ico"
          class:on={displayMenu}
          title={t('stage.display')}
          onclick={(e) => {
            e.stopPropagation();
            closeGlobalMenus();
            displayMenu = !displayMenu;
          }}>▦</button
        >
        {#if displayMenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="menu right wide" onpointerdown={(e) => e.stopPropagation()}>
            <div class="mhdr">{t('stage.displayMode')}</div>
            <button class="mitem" class:sel={display === 'cinematic'} onclick={() => pickDisplay('cinematic')}
              >{t('stage.cinematic')}</button
            >
            <button class="mitem" class:sel={display === 'plain'} onclick={() => pickDisplay('plain')}
              >{t('stage.plain')}</button
            >
            {#if onairHistory.entries.length}
              <div class="mhdr">{t('stage.recent')}</div>
              {#each onairHistory.entries as h (h.id)}
                <button class="mitem" onclick={() => putOnAir(h.payload)} title={t('stage.reair')}
                  >{describeOnAir(h.payload).label ?? '—'}</button
                >
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="main">
    <!-- NPC source drawer (slides in from the edge; NPCs only) -->
    <aside class="drawer" class:open={drawerOpen}>
      {#if drawerOpen}
        <div class="drawerhd">
          <span class="raillbl">{t('stage.npcs')}</span>
          <button class="ico xs" title={t('stage.collapseDrawer')} onclick={() => (drawerOpen = false)}>‹</button>
        </div>
        <div class="drawersub">{t('stage.dragNpc')}</div>
        <div class="chips">
          {#each npcs.list as n (n.id)}
            <button
              class="srcchip"
              draggable="true"
              ondragstart={(e) => e.dataTransfer?.setData('application/x-stage-npc', n.id)}
              ondblclick={() => stage.addTile('npc', { npcId: n.id })}
              title={g(n.name)}
            >
              {#if n.portraitId && urls[n.portraitId]}
                <img src={urls[n.portraitId]} alt="" />
              {:else}
                <span class="ini">{g(n.name).slice(0, 2).toUpperCase()}</span>
              {/if}
              <span class="cn">{g(n.name)}</span>
            </button>
          {:else}
            <span class="muted small">—</span>
          {/each}
        </div>
      {:else}
        <button class="drawertab" title={t('stage.openDrawer')} onclick={() => (drawerOpen = true)}
          >{t('stage.npcs')} ›</button
        >
      {/if}
    </aside>

    <!-- board (locked to broadcast aspect) -->
    <div class="boardwrap">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="board"
        class:over={dragOver}
        class:lasermode={laserOn}
        bind:this={board}
        style="grid-template-columns: repeat({cols}, 1fr); grid-template-rows: repeat({rows}, 1fr)"
        onpointerenter={() => (hovered = true)}
        onpointermove={boardLaser}
        onpointerleave={() => {
          hovered = false;
          if (laserOn) sendLaser(0, 0, false);
        }}
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={onDrop}
      >
        {#each stage.tiles as tl (tl.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="tile"
            class:sel={tl.id === stage.selected}
            class:hidden={tl.hidden}
            data-tile={tl.id}
            style="grid-column: {tl.col} / span {tl.cw}; grid-row: {tl.row} / span {tl.rh}{tl.z !==
            undefined
              ? `; z-index:${tl.z}`
              : ''}"
            onpointerdown={(e) => startMove(e, tl)}
            onpointermove={onMove}
            onpointerup={endMove}
            onpointerenter={(e) => {
              if (tl.kind === 'npc' && tl.npcId && !moving && !resizing)
                peek?.schedule(e.currentTarget, tl.npcId);
            }}
            onpointerleave={() => peek?.scheduleClose()}
          >
            <!-- Full-bleed content: a faithful preview of the broadcast cell. -->
            <div class="content">
              {#if tl.kind === 'text'}
                {#if tl.title || tl.body}
                  <div class="ttext">
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
                  {#if tl.moon}<span class="tmoon">☾ {tl.moon}</span>{/if}
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
            </div>

            <!-- gold corner resize handle (selected/hover only) -->
            <button
              class="rsz"
              data-control
              aria-label="resize"
              onpointerdown={(e) => startResize(e, tl)}
              onpointermove={onMove}
              onpointerup={endMove}
            ></button>
          </div>
        {/each}

        {#if stage.tiles.length === 0}
          <div class="empty">
            <div class="emptycard">
              <div class="emico">⊕</div>
              <div class="emttl">{t('stage.emptyTitle')}</div>
              <div class="emsub">{t('stage.emptyHint')}</div>
              <div class="emkinds">
                {#each KINDS as k (k)}
                  <button class="emkind" onclick={() => addKind(k)}>{kindLabel(k)}</button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- scene tabs + presets menu -->
  <div class="tabsrow">
    <div class="tabs" role="tablist">
      {#each stage.scenes as s (s.id)}
        <div class="tab" class:active={s.id === stage.activeId}>
          {#if editingScene === s.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="tabedit"
              value={s.name}
              autofocus
              aria-label={t('stage.sceneName')}
              onblur={(e) => {
                stage.renameScene(s.id, (e.currentTarget as HTMLInputElement).value.trim() || s.name);
                editingScene = null;
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                else if (e.key === 'Escape') editingScene = null;
              }}
            />
          {:else}
            <button
              class="tablabel"
              role="tab"
              aria-selected={s.id === stage.activeId}
              onclick={() => stage.setActive(s.id)}
              ondblclick={() => (editingScene = s.id)}>{s.name}</button
            >
            <button
              class="tabx"
              disabled={stage.scenes.length <= 1}
              aria-label={t('stage.closePre') + s.name}
              onclick={() => stage.removeScene(s.id)}><Icon name="close" size={12} /></button
            >
          {/if}
        </div>
      {/each}
      <button class="tabadd" onclick={() => stage.addScene()} title={t('stage.addScene')} aria-label={t('stage.addScene')}
        ><Icon name="plus" /></button
      >
      <button
        class="tabadd"
        onclick={() => stage.duplicateScene()}
        title={t('stage.duplicateScene')}
        aria-label={t('stage.duplicateScene')}>⧉</button
      >
    </div>

    <div class="mwrap">
      <button
        class="btn ghost"
        class:on={presetMenu}
        onclick={(e) => {
          e.stopPropagation();
          closeGlobalMenus();
          presetMenu = !presetMenu;
        }}>▤ {t('stage.presets')}</button
      >
      {#if presetMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="menu up right wide" onpointerdown={(e) => e.stopPropagation()}>
          <button class="mitem" disabled={stage.tiles.length === 0} onclick={() => stage.distribute()}
            >{t('stage.distribute')} · {t('stage.distributeHint')}</button
          >
          <div class="mhdr">{t('stage.presets')}</div>
          {#each stage.presets as p (p.id)}
            <div class="prow">
              <button class="mitem grow" onclick={() => stage.applyPreset(p.id)} title={t('stage.applyPreset')}
                >{p.name}</button
              >
              <button class="px" aria-label={t('stage.removePreset')} onclick={() => stage.removePreset(p.id)}
                >×</button
              >
            </div>
          {:else}
            <span class="muted small pad">{t('stage.noPresets')}</span>
          {/each}
          <button class="mitem save" onclick={savePreset}>{t('stage.savePreset')}</button>
        </div>
      {/if}
    </div>
  </div>

  <!-- GM-only NPC peek: a fixed overlay in the GM window; never broadcast. -->
  <NpcPeek bind:this={peek} onPickImage={pickBroadcastImage} />
</div>

<!-- Floating action bar — kind-agnostic verbs, anchored above the selected tile. -->
{#if sel && anchor}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="abar" style={barStyle} onpointerdown={(e) => e.stopPropagation()}>
    <button class="ab" class:on={editOpen} onclick={() => (editOpen = !editOpen)}>{t('stage.edit')}</button>
    <div class="mwrap">
      <button
        class="ab"
        class:on={kindMenu}
        onclick={(e) => {
          e.stopPropagation();
          closeTileMenus();
          kindMenu = !kindMenu;
        }}>{t('stage.kind')}</button
      >
      {#if kindMenu}
        <div class="menu">
          {#each KINDS as k (k)}
            <button
              class="mitem"
              class:sel={sel.kind === k}
              onclick={() => {
                stage.patchTile(sel.id, { kind: k });
                kindMenu = false;
              }}>{kindLabel(k)}</button
            >
          {/each}
        </div>
      {/if}
    </div>
    <button class="ab" onclick={() => stage.spotlight(sel.id)} title={t('stage.spotlightHint')}
      >{t('stage.spotlight')}</button
    >
    <button
      class="ab"
      title={sel.hidden ? t('stage.show') : t('stage.hide')}
      onclick={() => stage.toggleHidden(sel.id)}>{sel.hidden ? t('stage.showShort') : t('stage.hideShort')}</button
    >
    <div class="mwrap">
      <button
        class="ab"
        class:on={layerMenu}
        onclick={(e) => {
          e.stopPropagation();
          closeTileMenus();
          layerMenu = !layerMenu;
        }}>{t('stage.layer')}</button
      >
      {#if layerMenu}
        <div class="menu">
          <button class="mitem" onclick={() => { stage.bringToFront(sel.id); layerMenu = false; }}
            >{t('stage.front')}</button
          >
          <button class="mitem" onclick={() => { stage.sendToBack(sel.id); layerMenu = false; }}
            >{t('stage.back')}</button
          >
        </div>
      {/if}
    </div>
    <button class="ab" onclick={() => stage.duplicateTile(sel.id)}>{t('stage.duplicate')}</button>
    <button class="ab danger" onclick={() => stage.removeTile(sel.id)}>{t('stage.delete')}</button>
  </div>

  <!-- Edit popover — per-kind fields, anchored to the tile. -->
  {#if editOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pop" style={popStyle} onpointerdown={(e) => e.stopPropagation()}>
      <div class="pophd">
        <span>{t('stage.edit').toUpperCase()} · {kindLabel(sel.kind)}</span>
        <button class="ico xs" aria-label={t('stage.close')} onclick={() => (editOpen = false)}>✕</button>
      </div>

      {#if sel.kind === 'image'}
        <div class="fld">
          <span class="flbl">{t('stage.source')}</span>
          <div class="frow">
            <label class="btn sm">{t('stage.chooseImage')}<input type="file" accept="image/*" hidden onchange={(e) => pickImage(e, sel.id)} /></label>
            <input
              class="in grow"
              placeholder={t('stage.imageUrlPlaceholder')}
              value={sel.src ?? ''}
              oninput={(e) => stage.patchTile(sel.id, { src: (e.currentTarget as HTMLInputElement).value || undefined })}
            />
          </div>
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.captionPlaceholder')}</span>
          <input
            class="in"
            placeholder={t('stage.captionPlaceholder')}
            value={sel.caption ?? ''}
            oninput={(e) => stage.patchTile(sel.id, { caption: (e.currentTarget as HTMLInputElement).value || undefined })}
          />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.reveal')}</span>
          <div class="seg">
            {#each [['', 'revealNone'], ['blur', 'revealBlur'], ['panh', 'revealPanH'], ['panv', 'revealPanV']] as [val, key] (key)}
              <button
                class:on={(sel.reveal ?? '') === val}
                onclick={() => stage.patchTile(sel.id, { reveal: (val || undefined) as Tile['reveal'] })}
                >{t('stage.' + key)}</button
              >
            {/each}
          </div>
        </div>
      {:else if sel.kind === 'text'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input
            class="in"
            placeholder={t('stage.titlePlaceholder')}
            value={sel.title ?? ''}
            oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })}
          />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.bodyPlaceholder')}</span>
          <input
            class="in"
            placeholder={t('stage.bodyPlaceholder')}
            value={sel.body ?? ''}
            oninput={(e) => stage.patchTile(sel.id, { body: (e.currentTarget as HTMLInputElement).value || undefined })}
          />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.theme')}</span>
          <div class="seg">
            {#each [['', 'themeNone'], ['parchment', 'themeParchment'], ['letter', 'themeLetter'], ['telegram', 'themeTelegram']] as [val, key] (key)}
              <button
                class:on={(sel.theme ?? '') === val}
                onclick={() => stage.patchTile(sel.id, { theme: (val || undefined) as Tile['theme'] })}
                >{t('stage.' + key)}</button
              >
            {/each}
          </div>
        </div>
      {:else if sel.kind === 'clock'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input
            class="in"
            placeholder={t('stage.titlePlaceholder')}
            value={sel.title ?? ''}
            oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })}
          />
        </div>
        <div class="fld">
          <span class="flbl">{t('stage.seconds')}</span>
          <input
            class="in"
            type="number"
            min="0"
            value={sel.seconds ?? 60}
            oninput={(e) => stage.patchTile(sel.id, { seconds: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })}
          />
        </div>
      {:else if sel.kind === 'date'}
        <div class="fld">
          <span class="flbl">{t('stage.titlePlaceholder')}</span>
          <input
            class="in"
            placeholder={t('stage.titlePlaceholder')}
            value={sel.title ?? ''}
            oninput={(e) => stage.patchTile(sel.id, { title: (e.currentTarget as HTMLInputElement).value || undefined })}
          />
        </div>
        <button class="btn sm" onclick={() => refreshDate(sel)}>{t('stage.refreshDate')}</button>
      {:else}
        <div class="fld">
          <span class="flbl">{t('stage.pickNpc')}</span>
          <select
            class="in"
            value={sel.npcId ?? ''}
            onchange={(e) => stage.patchTile(sel.id, { npcId: (e.currentTarget as HTMLSelectElement).value || undefined })}
          >
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

  /* title strip */
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-radius: 8px 8px 0 0;
    background: rgba(9, 16, 13, 0.9);
    border: 1px solid var(--line2);
    border-bottom: 0;
  }
  .dots {
    display: inline-flex;
    gap: 5px;
  }
  .dots i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--line2);
  }
  .ttl {
    font-size: 10px;
    letter-spacing: 0.16em;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* control strip */
  .strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .compose {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .onair {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 7px;
    border: 1px solid var(--gold);
    border-radius: 8px;
    background: rgba(199, 164, 78, 0.06);
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
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    background: rgba(47, 138, 102, 0.18);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.on {
    border-color: var(--gold);
    background: rgba(199, 164, 78, 0.2);
    color: var(--gold);
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
    border-color: var(--gold);
    background: var(--gold);
    color: #120d02;
    font-weight: 700;
  }
  .btn.panic:hover {
    border-color: var(--red, #d05a52);
    color: var(--red, #ffb4ad);
    background: rgba(180, 60, 52, 0.18);
  }
  .btn.sm {
    padding: 4px 8px;
    font-size: 11px;
  }
  .btn.ghost {
    background: transparent;
    border-color: var(--line2);
    color: var(--muted);
    font-size: 11px;
    padding: 4px 9px;
  }

  .ico {
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
  }
  .ico:hover:not(:disabled) {
    background: rgba(47, 138, 102, 0.18);
  }
  .ico:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ico.on {
    border-color: var(--gold);
    color: var(--gold);
    background: rgba(199, 164, 78, 0.16);
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

  /* dropdown menus */
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
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: #0c130f;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .menu.right {
    left: auto;
    right: 0;
  }
  .menu.up {
    top: auto;
    bottom: calc(100% + 4px);
  }
  .menu.wide {
    min-width: 200px;
  }
  .mhdr {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 4px 6px 2px;
  }
  .mitem {
    text-align: left;
    padding: 5px 8px;
    border: 0;
    border-radius: 5px;
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
    background: rgba(47, 138, 102, 0.18);
  }
  .mitem:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .mitem.sel {
    color: var(--gold);
    background: rgba(199, 164, 78, 0.14);
  }
  .mitem.grow {
    flex: 1;
    min-width: 0;
  }
  .mitem.save {
    margin-top: 4px;
    border: 1px solid var(--line2);
    color: var(--green);
    text-align: center;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .px {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .px:hover {
    color: var(--red);
  }
  .pad {
    padding: 4px 6px;
  }

  /* layout */
  .main {
    flex: 1;
    display: flex;
    gap: 8px;
    min-height: 0;
  }
  .drawer {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
  }
  .drawer.open {
    flex-basis: 138px;
  }
  .drawerhd {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .drawersub {
    font-size: 10px;
    color: var(--faint);
    line-height: 1.3;
  }
  .drawertab {
    writing-mode: vertical-rl;
    padding: 8px 3px;
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.5);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  .drawertab:hover {
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .raillbl {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
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
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.5);
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
    border-radius: 4px;
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
    border-radius: 8px;
    border: 1px solid var(--line2);
    background-color: #05090a;
    background-image: linear-gradient(rgba(47, 138, 102, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(47, 138, 102, 0.06) 1px, transparent 1px);
    background-size: calc(100% / 12) calc(100% / 8);
    touch-action: none;
    overflow: hidden;
  }
  .board.over {
    border-color: var(--green);
    box-shadow: inset 0 0 0 2px rgba(47, 138, 102, 0.4);
  }

  /* empty-state call to action */
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
    border-radius: 12px;
    text-align: center;
  }
  .emico {
    font-size: 30px;
    color: var(--green-dim);
  }
  .emttl {
    font-family: Georgia, serif;
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
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: rgba(20, 28, 22, 0.5);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .emkind:hover {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.18);
  }

  /* tiles */
  .tile {
    position: relative;
    min-width: 0;
    min-height: 0;
    border: 1px solid transparent;
    background: rgba(20, 28, 22, 0.4);
    overflow: hidden;
    cursor: move;
  }
  .tile.sel {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold);
    z-index: 2;
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
    padding: 3px 6px;
    background: rgba(5, 9, 10, 0.6);
    color: #e9f3ed;
    font-size: 11px;
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
    font-family: Georgia, serif;
    color: var(--green);
    font-size: 14px;
    margin-bottom: 4px;
  }
  .ttext span {
    font-size: 12px;
    line-height: 1.4;
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
    font-family: Georgia, serif;
    color: var(--green);
    font-size: 26px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tmmid {
    font-family: Georgia, serif;
    color: var(--txt);
    font-size: 15px;
  }
  .tmoon {
    color: var(--gold);
    font-size: 11px;
  }
  .ttime {
    color: var(--muted);
    font-size: 11px;
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

  /* floating action bar (fixed, follows the selected tile) */
  .abar {
    position: fixed;
    z-index: 60;
    transform: translateY(-100%);
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: #0c130f;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  }
  .ab {
    padding: 4px 8px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    white-space: nowrap;
  }
  .ab:hover {
    background: rgba(47, 138, 102, 0.18);
  }
  .ab.on {
    color: var(--gold);
    background: rgba(199, 164, 78, 0.14);
  }
  .ab.danger:hover {
    background: rgba(180, 60, 52, 0.22);
    color: #ffb4ad;
  }

  /* edit popover (fixed, anchored beside the selected tile) */
  .pop {
    position: fixed;
    z-index: 60;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--line2);
    background: #0c130f;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
  }
  .pophd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 9px;
    letter-spacing: 0.14em;
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
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .in {
    box-sizing: border-box;
    width: 100%;
    padding: 5px 7px;
    font: inherit;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: #11160f;
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
    border-radius: 6px 0 0 6px;
  }
  .seg button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg button.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
    border-color: var(--green-dim);
  }

  /* tabs row */
  .tabsrow {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
  }
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 4px;
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
    border-color: var(--gold);
    background: rgba(199, 164, 78, 0.16);
  }
  .tablabel {
    padding: 4px 9px;
    font-size: 12px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab.active .tablabel {
    color: var(--txt);
    font-weight: 600;
  }
  .tabx {
    width: 18px;
    height: 18px;
    margin-right: 3px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--muted);
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
    color: var(--txt);
    border: 1px solid var(--gold);
    border-radius: 4px;
  }
  .tabadd {
    width: 26px;
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.5);
    color: var(--gold);
    cursor: pointer;
    font-size: 13px;
  }
  .tabadd:hover {
    background: rgba(199, 164, 78, 0.18);
  }

  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 11px;
  }
</style>
