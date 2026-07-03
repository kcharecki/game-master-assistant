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

  let board = $state<HTMLDivElement | null>(null);
  let hovered = $state(false);
  let display = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  let moodId = $state(DEFAULT_MOOD.id);
  // Laser pointer mode: while on, cursor over the board drives a live dot on air.
  let laserOn = $state(false);
  let lastLaser = 0;

  // --- GM-only NPC peek (never broadcast) -----------------------------------
  // Hovering a placed NPC tile shows a floating cheatsheet of that NPC's FULL
  // record (gmNotes/inventory) as a presenting aid — see NpcPeek. Its image
  // picker sets the NPC's broadcast portrait; re-airs immediately when live.
  let peek: ReturnType<typeof NpcPeek> | undefined;
  function pickBroadcastImage(assetId: string, id: string) {
    npcs.setPrimaryPhoto(id, assetId);
    if (stage.live) stage.broadcast();
  }

  const cols = $derived(stage.active.cols);
  const rows = $derived(stage.active.rows);

  onMount(() => {
    stage.onAir = putOnAir;
    void stage.load();
    void npcs.load();
    void calendar.load();
    const onPaste = (e: ClipboardEvent) => void handlePaste(e);
    const onKey = (e: KeyboardEvent) => handleKey(e);
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
    };
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
    peek?.cancel(); // dragging shouldn't pop a hover card
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
      stage.placeTile(moving, {
        col: c.col - grabCol,
        row: c.row - grabRow,
        cw: tl.cw,
        rh: tl.rh,
      });
    } else if (resizing) {
      const c = cellAt(e);
      const tl = stage.tiles.find((x) => x.id === resizing)!;
      stage.placeTile(resizing, {
        col: tl.col,
        row: tl.row,
        cw: Math.max(1, c.col - tl.col + 1),
        rh: Math.max(1, c.row - tl.row + 1),
      });
    }
  }
  function endMove(e: PointerEvent) {
    moving = null;
    resizing = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
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
  }

  // --- toolbar actions ------------------------------------------------------
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

  // Snapshot the calendar's in-world date + moon and the Timeline clock onto a new tile.
  function addDateTile() {
    stage.addTile('date', { date: calendar.label, time: calendar.clock, moon: calendar.moon });
  }
  // Refresh a date tile from the calendar + Timeline current state.
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
    if (now - lastLaser < 30) return; // ~33 Hz is plenty for a smooth dot
    lastLaser = now;
    const { fx, fy } = frac(e);
    sendLaser(fx, fy, true);
  }

  // --- scene tab rename -----------------------------------------------------
  let editingScene = $state<string | null>(null);

  const sel = $derived(stage.tiles.find((tl) => tl.id === stage.selected) ?? null);
</script>

<div class="stage">
  <!-- toolbar -->
  <div class="tbar">
    <button class="btn sm" onclick={() => stage.addTile('image')}>{t('stage.addImage')}</button>
    <button class="btn sm" onclick={() => stage.addTile('text')}>{t('stage.addText')}</button>
    <button class="btn sm" onclick={() => stage.addTile('npc')}>{t('stage.addNpc')}</button>
    <button class="btn sm" onclick={() => stage.addTile('clock', { seconds: 60 })} title={t('stage.addClockHint')}>{t('stage.addClock')}</button>
    <button class="btn sm" onclick={addDateTile} title={t('stage.addDateHint')}>{t('stage.addDate')}</button>
    <span class="sep"></span>
    <button
      class="btn sm"
      disabled={!stage.canUndo}
      onclick={() => stage.undo()}
      title={t('stage.undo')}>↶</button
    >
    <button
      class="btn sm"
      disabled={!stage.canRedo}
      onclick={() => stage.redo()}
      title={t('stage.redo')}>↷</button
    >
    <span class="sep"></span>
    <button
      class="btn sm"
      disabled={stage.tiles.length === 0}
      onclick={() => stage.distribute()}
      title={t('stage.distributeHint')}
    >
      <Icon name="tile" /> {t('stage.distribute')}
    </button>
    <span class="sep"></span>
    <button class="btn sm" class:laser={laserOn} onclick={toggleLaser} title={t('stage.laserHint')}>
      {t('stage.laser')}
    </button>
    <span class="sep"></span>
    <button
      class="btn sm"
      class:on={stage.live}
      onclick={() => stage.toggleLive()}
      title={t('stage.live')}
    >
      {stage.live ? t('stage.liveOn') : t('stage.live')}
    </button>
    <button class="btn sm solid" disabled={!stage.preview} onclick={() => stage.broadcast()}
      >{t('stage.toAir')}</button
    >
    <button class="btn sm" onclick={() => clearBroadcast()} aria-label={t('onair.panic')} title={t('onair.panicTitle')}><Icon name="close" /></button>
  </div>

  <!-- scene tabs -->
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
    <button
      class="tabadd"
      onclick={() => stage.addScene()}
      title={t('stage.addScene')}
      aria-label={t('stage.addScene')}><Icon name="plus" /></button
    >
    <button
      class="tabadd"
      onclick={() => stage.duplicateScene()}
      title={t('stage.duplicateScene')}
      aria-label={t('stage.duplicateScene')}>⧉</button
    >
  </div>

  <div class="main">
    <!-- source rail -->
    <aside class="rail">
      <div class="raillbl">{t('stage.sources')}</div>
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

      <div class="raillbl">{t('stage.presets')}</div>
      <div class="presets">
        {#each stage.presets as p (p.id)}
          <div class="prow">
            <button
              class="lnk"
              onclick={() => stage.applyPreset(p.id)}
              title={t('stage.applyPreset')}>{p.name}</button
            >
            <button
              class="px"
              aria-label={t('stage.removePreset')}
              onclick={() => stage.removePreset(p.id)}>×</button
            >
          </div>
        {:else}
          <span class="muted small">{t('stage.noPresets')}</span>
        {/each}
        <button class="btn sm wide" onclick={savePreset}>{t('stage.savePreset')}</button>
      </div>
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
                    <div class="tcap">
                      {tl.kind === 'npc' ? npcCaption(tl) : tl.caption}
                    </div>
                  {/if}
                {:else if tl.kind === 'npc'}
                  <div class="ttext"><strong>{npcCaption(tl)}</strong></div>
                {:else}
                  <div class="ph">{t('stage.dropHere')}</div>
                {/if}
              {/if}
            </div>

            <!-- Chrome overlay (hover / selected only) — never on the broadcast. -->
            <div class="chrome" data-control>
              <span class="tk"
                >{t('stage.kind' + tl.kind.charAt(0).toUpperCase() + tl.kind.slice(1))}</span
              >
              <button
                class="ti"
                aria-label={tl.hidden ? t('stage.show') : t('stage.hide')}
                onclick={() => stage.toggleHidden(tl.id)}>{tl.hidden ? '🚫' : '👁'}</button
              >
              <button
                class="ti"
                aria-label={t('stage.remove')}
                onclick={() => stage.removeTile(tl.id)}><Icon name="close" size={12} /></button
              >
            </div>

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
          <div class="empty">{t('stage.dropHere')}</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- inspector / snap + mood + display -->
  <div class="foot">
    {#if sel}
      <button
        class="btn sm solid"
        onclick={() => stage.spotlight(sel.id)}
        title={t('stage.spotlightHint')}>{t('stage.spotlight')}</button
      >
      <span class="flbl">{t('stage.swapKind')}</span>
      <select
        class="in narrow"
        value={sel.kind}
        onchange={(e) =>
          stage.patchTile(sel.id, {
            kind: (e.currentTarget as HTMLSelectElement).value as TileKind,
          })}
      >
        <option value="image">{t('stage.kindImage')}</option>
        <option value="text">{t('stage.kindText')}</option>
        <option value="npc">{t('stage.kindNpc')}</option>
        <option value="clock">{t('stage.kindClock')}</option>
        <option value="date">{t('stage.kindDate')}</option>
      </select>

      <!-- z-order (layering: text over image) -->
      <button class="btn sm" onclick={() => stage.bringToFront(sel.id)} title={t('stage.frontHint')}
        >{t('stage.front')}</button
      >
      <button class="btn sm" onclick={() => stage.sendToBack(sel.id)} title={t('stage.backHint')}
        >{t('stage.back')}</button
      >

      {#if sel.kind === 'image'}
        <label class="btn sm"
          >{t('stage.chooseImage')}<input
            type="file"
            accept="image/*"
            hidden
            onchange={(e) => pickImage(e, sel.id)}
          /></label
        >
        <input
          class="in grow"
          placeholder={t('stage.imageUrlPlaceholder')}
          value={sel.src ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              src: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <input
          class="in grow"
          placeholder={t('stage.captionPlaceholder')}
          value={sel.caption ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              caption: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <span class="flbl">{t('stage.reveal')}</span>
        <select
          class="in narrow"
          value={sel.reveal ?? ''}
          onchange={(e) =>
            stage.patchTile(sel.id, {
              reveal:
                ((e.currentTarget as HTMLSelectElement).value as 'blur' | 'panh' | 'panv') ||
                undefined,
            })}
        >
          <option value="">{t('stage.revealNone')}</option>
          <option value="blur">{t('stage.revealBlur')}</option>
          <option value="panh">{t('stage.revealPanH')}</option>
          <option value="panv">{t('stage.revealPanV')}</option>
        </select>
      {:else if sel.kind === 'text'}
        <input
          class="in grow"
          placeholder={t('stage.titlePlaceholder')}
          value={sel.title ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              title: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <input
          class="in grow"
          placeholder={t('stage.bodyPlaceholder')}
          value={sel.body ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              body: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <span class="flbl">{t('stage.theme')}</span>
        <select
          class="in narrow"
          value={sel.theme ?? ''}
          onchange={(e) =>
            stage.patchTile(sel.id, {
              theme:
                ((e.currentTarget as HTMLSelectElement).value as
                  | 'parchment'
                  | 'letter'
                  | 'telegram') || undefined,
            })}
        >
          <option value="">{t('stage.themeNone')}</option>
          <option value="parchment">{t('stage.themeParchment')}</option>
          <option value="letter">{t('stage.themeLetter')}</option>
          <option value="telegram">{t('stage.themeTelegram')}</option>
        </select>
      {:else if sel.kind === 'clock'}
        <input
          class="in grow"
          placeholder={t('stage.titlePlaceholder')}
          value={sel.title ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              title: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <span class="flbl">{t('stage.seconds')}</span>
        <input
          class="in narrow"
          type="number"
          min="0"
          value={sel.seconds ?? 60}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              seconds: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0),
            })}
        />
      {:else if sel.kind === 'date'}
        <input
          class="in grow"
          placeholder={t('stage.titlePlaceholder')}
          value={sel.title ?? ''}
          oninput={(e) =>
            stage.patchTile(sel.id, {
              title: (e.currentTarget as HTMLInputElement).value || undefined,
            })}
        />
        <button class="btn sm" onclick={() => refreshDate(sel)}>{t('stage.refreshDate')}</button>
      {:else}
        <select
          class="in narrow"
          value={sel.npcId ?? ''}
          onchange={(e) =>
            stage.patchTile(sel.id, {
              npcId: (e.currentTarget as HTMLSelectElement).value || undefined,
            })}
        >
          <option value="">{t('stage.pickNpc')}</option>
          {#each npcs.list as n (n.id)}<option value={n.id}>{g(n.name)}</option>{/each}
        </select>
      {/if}

    {:else}
      <span class="flbl">{t('stage.display')}</span>
      <div class="seg">
        <button class:on={display === 'cinematic'} onclick={() => pickDisplay('cinematic')}
          >{t('stage.cinematic')}</button
        >
        <button class:on={display === 'plain'} onclick={() => pickDisplay('plain')}
          >{t('stage.plain')}</button
        >
      </div>
      <span class="flbl">{t('stage.mood')}</span>
      <div class="moods">
        {#each MOODS as m (m.id)}
          <button class="moodbtn" class:on={moodId === m.id} onclick={() => pickMood(m.id)}
            >{m.label}</button
          >
        {/each}
      </div>
      {#if onairHistory.entries.length}
        <span class="flbl">{t('stage.recent')}</span>
        <div class="hist">
          {#each onairHistory.entries as h (h.id)}
            <button
              class="histbtn"
              onclick={() => putOnAir(h.payload)}
              title={t('stage.reair')}>{describeOnAir(h.payload).label ?? '—'}</button
            >
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- GM-only NPC peek: a fixed overlay in the GM window; never broadcast. -->
  <NpcPeek bind:this={peek} onPickImage={pickBroadcastImage} />
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 6px;
    overflow: hidden;
  }
  .tbar {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--line2);
    margin: 2px 3px;
  }
  .btn.sm {
    padding: 5px 9px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm:hover:not(:disabled) {
    background: rgba(47, 138, 102, 0.18);
  }
  .btn.sm:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.sm.on {
    border-color: var(--gold);
    background: rgba(199, 164, 78, 0.2);
    color: var(--gold);
  }
  .btn.sm.laser {
    border-color: #ff5a5a;
    background: rgba(255, 45, 45, 0.18);
    color: #ff8a8a;
  }
  .board.lasermode {
    cursor: crosshair;
  }
  .btn.sm.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .btn.sm.wide {
    width: 100%;
    margin-top: 4px;
  }

  /* tabs */
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

  /* layout */
  .main {
    flex: 1;
    display: flex;
    gap: 8px;
    min-height: 0;
  }
  .rail {
    flex: 0 0 132px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
  }
  .raillbl {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 4px;
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
  .presets {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lnk {
    flex: 1;
    min-width: 0;
    text-align: left;
    padding: 3px 6px;
    border: 1px solid var(--line2);
    border-radius: 6px;
    background: rgba(20, 28, 22, 0.5);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    touch-action: none;
    overflow: hidden;
  }
  .board.over {
    border-color: var(--green);
    box-shadow: inset 0 0 0 2px rgba(47, 138, 102, 0.4);
  }
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--faint);
    font-size: 12px;
    letter-spacing: 0.08em;
    pointer-events: none;
  }

  /* A tile is a faithful preview of its broadcast cell: full-bleed content,
     editing chrome overlaid only on hover/select. */
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
    margin: 0;
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
  /* clock / date tile previews */
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
  .chrome {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 18px;
    padding: 0 4px;
    background: rgba(9, 16, 13, 0.78);
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tile:hover .chrome,
  .tile.sel .chrome {
    opacity: 1;
  }
  .tk {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ti {
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
  }
  .ti:hover {
    color: var(--txt);
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

  /* footer */
  .foot {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .flbl {
    color: var(--muted);
    font-size: 11px;
  }
  .in {
    box-sizing: border-box;
    padding: 4px 7px;
    font: inherit;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: #11160f;
    color: var(--txt);
  }
  .grow {
    flex: 1 1 120px;
    min-width: 90px;
  }
  .narrow {
    width: auto;
    flex: 0 0 auto;
  }
  .seg {
    display: flex;
  }
  .seg button {
    padding: 4px 10px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .seg button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg button:last-child {
    border-radius: 0 6px 6px 0;
    border-left: 0;
  }
  .seg button.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
  }
  .moods {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .moodbtn {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
  }
  .moodbtn.on {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .hist {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    max-width: 100%;
  }
  .histbtn {
    max-width: 120px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .histbtn:hover {
    border-color: var(--green-dim);
    color: var(--txt);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 11px;
  }
</style>
