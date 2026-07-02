<script lang="ts">
  import { onMount } from 'svelte';
  import { createBus } from '../lib/bus';
  import { kvGet, assetUrl } from '../lib/db';
  import { lang, t } from '../lib/i18n';
  import type { AudioQueueItem, BroadcastPayload, DisplayMode } from '../lib/types';
  import { advanceIndex, crossfadeGains, effectiveVolume } from '../modules/audio/logic';
  import { DISPLAY_MODE_KEY, DEFAULT_DISPLAY_MODE, normalizeMode } from './display';
  import { MOOD_KEY, DEFAULT_MOOD, moodById, normalizeMood, moodStyle, type Mood } from './mood';
  import { clampCols, gridAssetIds } from './grid';
  import { conditionGlyph, conditionMeta } from '../modules/map/conditions';

  let payload = $state<BroadcastPayload>({ kind: 'clear' });
  let mode = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);
  let mood = $state<Mood>(DEFAULT_MOOD);
  const mstyle = $derived(moodStyle(mood));
  // Transient ping marker (normalized 0..1) that overlays current content.
  let ping = $state<{ x: number; y: number } | null>(null);
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  // Steady laser dot (normalized 0..1), shown until the GM turns it off.
  let laser = $state<{ x: number; y: number } | null>(null);
  const CELL = 48; // viewBox cell size; aspect-ratio only, scales to fit

  // --- Ambient sequencer (native audio) -------------------------------------
  // Two ambient elements A/B let us crossfade between tracks; `activeIdx` marks
  // the foreground one. The queue + flags are handed over by the GM; the timers
  // that drive auto-advance/crossfade live here (this tab isn't throttled).
  let ambientA: HTMLAudioElement;
  let ambientB: HTMLAudioElement;
  let ambientEls: HTMLAudioElement[] = [];
  let activeIdx = 0;
  let queue: AudioQueueItem[] = [];
  let qIndex = 0;
  let loopTrack = false;
  let loopList = true;
  let crossfadeMs = 0;
  let chanVol = 1; // effective ambient channel volume (master×ambient)
  let duckFactor = 1; // <1 while an SFX ducks the bed
  let curGain = 1; // on-air track's per-track gain
  let fading = false; // crossfade in progress
  const elUrl = ['', '']; // object URL per element (revoke on replace)
  let fadeTimer: ReturnType<typeof setInterval> | undefined;
  let lastPlayCue: Extract<BroadcastPayload, { kind: 'audio' }> | null = null;

  // One-shot SFX play on a small pool so rapid triggers overlap instead of
  // cutting each other off. Created in onMount (needs `window`).
  let sfxPool: HTMLAudioElement[] = [];
  let sfxRR = 0;
  let sfxActive = 0; // live shots, for duck release

  // Browsers block audio until the user interacts with THIS tab. Until unlocked,
  // we hold the last cue and replay it once the keeper clicks to enable sound.
  let audioLocked = $state(false);
  let pendingCue: Extract<BroadcastPayload, { kind: 'audio' }> | null = null;

  // YouTube ambient: rendered as an iframe (autoplay/loop embed). No JS seek
  // (IFrame API out of scope); Rewind/skip re-mounts via `youtubeNonce`.
  let youtubeId = $state<string | null>(null);
  let youtubeNonce = $state(0);
  // Sound-only mode: keep the iframe playing but hidden offscreen (players see
  // only the normal broadcast content). Unmuted so it's actually audible.
  let youtubeAudioOnly = $state(false);
  // Foreground arbitration: the most recent action wins the screen. Playing a
  // video-mode YT track foregrounds the video; pushing any on-air content
  // foregrounds that content (and backgrounds the video). The video also shows
  // when the stage is clear. Audio-only is always hidden in the background.
  let ytVideoFg = $state(false);
  const ytBackground = $derived(youtubeAudioOnly || (!ytVideoFg && payload.kind !== 'clear'));

  // Preview mode (?preview=1): a silent visual mirror embedded on the GM desktop.
  // It renders all on-air visuals (incl. a muted YouTube video) but never plays
  // audio — otherwise the preview would double the broadcast tab's sound.
  const isPreview =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('preview');
  // Reverse status channel back to the GM tab; opened in onMount (no import-time bus).
  let statusBus: ReturnType<typeof createBus> | null = null;
  let lastStatusAt = 0;

  const active = () => ambientEls[activeIdx];
  const idle = () => ambientEls[1 - activeIdx];
  const targetVol = (gain: number) => effectiveVolume(chanVol, gain, duckFactor);
  function applyActiveVol() {
    const el = active();
    if (el && !fading) el.volume = targetVol(curGain);
  }

  function postAmbientStatus(force = false) {
    if (!statusBus) return;
    const el = active();
    const now = Date.now();
    if (!force && now - lastStatusAt < 500) return; // throttle timeupdate to ~2/s
    lastStatusAt = now;
    const duration = el && Number.isFinite(el.duration) ? el.duration : 0;
    statusBus.sendAudioStatus({
      channel: 'ambient',
      current: el ? el.currentTime : 0,
      duration,
      playing: youtubeId ? true : !!el && !el.paused,
      index: qIndex,
      count: queue.length,
    });
  }

  // Resolve an on-air image's asset to a tab-local URL (assetId), or use an
  // external src directly. blob: URLs from the GM tab never resolve here.
  let imgSrc = $state('');
  $effect(() => {
    const p = payload;
    if (p.kind !== 'image') {
      imgSrc = '';
      return;
    }
    if (p.src) {
      imgSrc = p.src;
      return;
    }
    if (p.assetId) {
      let url = '';
      void assetUrl(p.assetId).then((u) => {
        if (u) {
          url = u;
          imgSrc = u;
        }
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
    imgSrc = '';
  });

  // Resolve a map background's asset (assetId) to a tab-local URL, or use an
  // external src directly — same cross-tab blob rule as on-air images.
  let mapSrc = $state('');
  $effect(() => {
    const p = payload;
    if (p.kind !== 'map') {
      mapSrc = '';
      return;
    }
    if (p.src) {
      mapSrc = p.src;
      return;
    }
    if (p.assetId) {
      let url = '';
      void assetUrl(p.assetId).then((u) => {
        if (u) {
          url = u;
          mapSrc = u;
        }
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
    mapSrc = '';
  });

  // Resolve grid image cells' asset ids -> tab-local object URLs, revoking
  // any no-longer-referenced URLs. Same asset-id-over-bus rule as `imgSrc`.
  let gridUrls = $state<Record<string, string>>({});
  $effect(() => {
    const want = payload.kind === 'grid' ? new Set(gridAssetIds(payload.cells)) : new Set<string>();
    for (const [id, url] of Object.entries(gridUrls)) {
      if (!want.has(id)) {
        URL.revokeObjectURL(url);
        delete gridUrls[id];
      }
    }
    for (const id of want) {
      if (!gridUrls[id]) {
        void assetUrl(id).then((u) => {
          if (u) gridUrls[id] = u;
        });
      }
    }
  });
  $effect(() => () => {
    for (const url of Object.values(gridUrls)) URL.revokeObjectURL(url);
  });

  function flashPing(x: number, y: number) {
    ping = { x, y };
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => (ping = null), 1500);
  }

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  // Load an ambient queue item's blob into an element, revoking the URL the slot
  // held before. Returns false if the asset can't be resolved.
  async function loadInto(el: HTMLAudioElement, item: AudioQueueItem): Promise<boolean> {
    const slot = ambientEls.indexOf(el);
    if (slot >= 0 && elUrl[slot]) {
      URL.revokeObjectURL(elUrl[slot]);
      elUrl[slot] = '';
    }
    const url = item.assetId ? await assetUrl(item.assetId) : item.src;
    if (!url) return false;
    if (slot >= 0 && item.assetId) elUrl[slot] = url;
    el.src = url;
    el.loop = loopTrack;
    return true;
  }

  // Mount a YouTube ambient item (pauses native ambience; (re)mounts the iframe).
  function mountYouTube(item: AudioQueueItem) {
    for (const el of ambientEls) el.pause();
    youtubeId = item.youtubeId ?? null;
    youtubeAudioOnly = !!item.audioOnly;
    ytVideoFg = !item.audioOnly;
    youtubeNonce += 1;
  }

  // Move the ambient sequencer to queue[index], crossfading over `cf` ms (0 = cut).
  async function goTo(index: number, cf: number) {
    const item = queue[index];
    if (!item) return;
    qIndex = index;
    if (item.youtubeId) {
      mountYouTube(item);
      postAmbientStatus(true);
      return;
    }
    youtubeId = null; // switching to native audio tears down any iframe
    const incoming = idle();
    const outgoing = active();
    if (!(await loadInto(incoming, item))) return;
    curGain = item.gain ?? 1;
    incoming.currentTime = 0;
    incoming.volume = cf > 0 ? 0 : targetVol(curGain);
    try {
      await incoming.play();
    } catch {
      pendingCue = lastPlayCue; // autoplay blocked — hold the scene, prompt unlock
      audioLocked = true;
      return;
    }
    if (cf > 0 && !outgoing.paused) {
      crossfade(outgoing, incoming, cf);
    } else {
      outgoing.pause();
      activeIdx = 1 - activeIdx;
    }
    postAmbientStatus(true);
  }

  // Linear crossfade: ramp `outEl` down from its level and `inEl` up to target.
  function crossfade(outEl: HTMLAudioElement, inEl: HTMLAudioElement, ms: number) {
    fading = true;
    clearInterval(fadeTimer);
    const start = performance.now();
    const outStart = outEl.volume;
    const tv = targetVol(curGain);
    fadeTimer = setInterval(() => {
      const e = performance.now() - start;
      const g = crossfadeGains(e, ms);
      outEl.volume = clamp01(outStart * g.out);
      inEl.volume = clamp01(tv * g.in);
      if (e >= ms) {
        clearInterval(fadeTimer);
        outEl.pause();
        outEl.volume = 0;
        activeIdx = ambientEls.indexOf(inEl);
        fading = false;
      }
    }, 30);
  }

  // Linear volume ramp on one element over `ms`, running `after` on completion.
  // Sets `fading` so auto-advance/applyActiveVol don't fight the ramp.
  function rampVolume(el: HTMLAudioElement, to: number, ms: number, after?: () => void) {
    clearInterval(fadeTimer);
    const start = performance.now();
    const v0 = el.volume;
    fading = true;
    fadeTimer = setInterval(() => {
      const e = performance.now() - start;
      const k = Math.min(1, e / ms);
      el.volume = clamp01(v0 + (to - v0) * k);
      if (e >= ms) {
        clearInterval(fadeTimer);
        fading = false;
        after?.();
      }
    }, 30);
  }

  // ~1s fade-out then halt both elements (avoids a jarring hard cut on Stop).
  function fadeOutStop() {
    const el = active();
    youtubeId = null;
    if (!el) {
      clearInterval(fadeTimer);
      return;
    }
    rampVolume(el, 0, 900, () => {
      for (const a of ambientEls) a.pause();
      postAmbientStatus(true);
    });
  }

  // One-shot SFX on the pool — overlaps ambience and (optionally) ducks it.
  async function playOneShot(cue: Extract<BroadcastPayload, { kind: 'audio' }>) {
    if (isPreview || !sfxPool.length) return;
    const url = cue.assetId ? await assetUrl(cue.assetId) : cue.src;
    if (!url) return;
    const el = sfxPool[sfxRR++ % sfxPool.length];
    el.pause();
    el.src = url;
    el.loop = false;
    el.volume = clamp01(cue.volume ?? 1);
    if (cue.duck) {
      sfxActive++;
      duckFactor = 0.4;
      applyActiveVol();
    }
    const release = () => {
      el.removeEventListener('ended', release);
      if (cue.assetId) URL.revokeObjectURL(url);
      if (cue.duck) {
        sfxActive = Math.max(0, sfxActive - 1);
        if (sfxActive === 0) {
          duckFactor = 1;
          applyActiveVol();
        }
      }
    };
    el.addEventListener('ended', release);
    el.play().catch(() => {
      pendingCue = cue;
      audioLocked = true;
      release();
    });
  }

  // Preview mirror: reflect only the YouTube video state; stay silent otherwise.
  function previewAmbient(cue: Extract<BroadcastPayload, { kind: 'audio' }>) {
    const showItem = (item?: AudioQueueItem) => {
      if (item?.youtubeId) {
        youtubeId = item.youtubeId;
        youtubeAudioOnly = !!item.audioOnly;
        ytVideoFg = !item.audioOnly;
        youtubeNonce += 1;
      } else {
        youtubeId = null;
      }
    };
    if (cue.action === 'stop') youtubeId = null;
    else if (cue.action === 'play') {
      queue = cue.queue ?? [];
      qIndex = cue.index ?? 0;
      showItem(queue[qIndex]);
    } else if (cue.action === 'next' || cue.action === 'prev') {
      const n = advanceIndex(qIndex, queue.length, { loopList: true }, cue.action === 'next' ? 1 : -1);
      if (n >= 0) {
        qIndex = n;
        showItem(queue[n]);
      }
    }
  }

  // Kill switch: hard-stop the ambient bed, every live SFX, and any YouTube.
  function panicStop() {
    clearInterval(fadeTimer);
    fading = false;
    youtubeId = null;
    queue = [];
    qIndex = 0;
    for (const a of ambientEls) {
      a.pause();
      a.volume = 0;
    }
    for (const el of sfxPool) el.pause();
    sfxActive = 0;
    duckFactor = 1;
    postAmbientStatus(true);
  }

  async function handleAudio(cue: Extract<BroadcastPayload, { kind: 'audio' }>) {
    if (cue.action === 'panic') {
      if (!isPreview) panicStop();
      else youtubeId = null;
      return;
    }
    if (cue.channel === 'sfx') {
      if (cue.action === 'play') void playOneShot(cue);
      return;
    }
    // ambient channel
    if (isPreview) {
      previewAmbient(cue);
      return;
    }
    switch (cue.action) {
      case 'play': {
        // If a native track is already playing, crossfade into the new scene
        // instead of hard-cutting (scene→scene crossfade).
        const el = active();
        const wasPlaying = !youtubeId && !!el && !el.paused;
        queue = cue.queue ?? [];
        loopTrack = !!cue.loopTrack;
        loopList = cue.loopList ?? true;
        crossfadeMs = cue.crossfadeMs ?? 0;
        chanVol = cue.volume ?? 1;
        lastPlayCue = cue;
        await goTo(cue.index ?? 0, wasPlaying ? crossfadeMs : 0);
        break;
      }
      case 'stop':
        fadeOutStop();
        queue = [];
        qIndex = 0;
        break;
      case 'pause': {
        const el = active();
        if (el && youtubeId === null && !el.paused) {
          rampVolume(el, 0, 600, () => {
            el.pause();
            postAmbientStatus(true);
          });
        } else if (el && youtubeId === null) el.pause();
        postAmbientStatus(true);
        break;
      }
      case 'resume': {
        const el = active();
        if (el && youtubeId === null) {
          el.volume = 0;
          void el
            .play()
            .then(() => rampVolume(el, targetVol(curGain), 600))
            .catch(() => {
              pendingCue = lastPlayCue;
              audioLocked = true;
            });
        }
        postAmbientStatus(true);
        break;
      }
      case 'next': {
        const n = advanceIndex(qIndex, queue.length, { loopList: true }, 1);
        if (n >= 0) await goTo(n, crossfadeMs);
        break;
      }
      case 'prev': {
        const n = advanceIndex(qIndex, queue.length, { loopList: true }, -1);
        if (n >= 0) await goTo(n, crossfadeMs);
        break;
      }
      case 'seek': {
        const el = active();
        if (el && youtubeId === null) {
          const dur = Number.isFinite(el.duration) ? el.duration : Infinity;
          el.currentTime = Math.min(Math.max(0, cue.seek ?? 0), dur);
          postAmbientStatus(true);
        }
        break;
      }
      case 'volume':
        chanVol = cue.volume ?? chanVol;
        applyActiveVol();
        break;
    }
  }

  // Auto-advance: near a track's end, start the crossfade to the next item.
  function onAmbientTimeUpdate(el: HTMLAudioElement) {
    postAmbientStatus();
    if (el !== active() || youtubeId || fading || loopTrack || crossfadeMs <= 0) return;
    const remaining = (Number.isFinite(el.duration) ? el.duration : Infinity) - el.currentTime;
    if (remaining <= crossfadeMs / 1000 && el.currentTime > crossfadeMs / 1000) {
      const n = advanceIndex(qIndex, queue.length, { loopList }, 1);
      if (n >= 0) void goTo(n, crossfadeMs);
    }
  }
  // Hard-cut advance when a track ends without a crossfade window.
  function onAmbientEnded(el: HTMLAudioElement) {
    if (el !== active() || youtubeId) return;
    if (loopTrack) {
      el.currentTime = 0;
      void el.play();
      return;
    }
    const n = advanceIndex(qIndex, queue.length, { loopList }, 1);
    if (n >= 0) void goTo(n, 0);
    else postAmbientStatus(true);
  }

  // First user gesture in this tab unlocks audio; replay any held cue.
  function unlockAudio() {
    audioLocked = false;
    const cue = pendingCue;
    pendingCue = null;
    if (cue) void handleAudio(cue);
  }

  onMount(() => {
    void lang.load();
    // Wire the ambient element pair + a small SFX pool (needs `window`).
    ambientEls = [ambientA, ambientB];
    sfxPool = isPreview ? [] : Array.from({ length: 6 }, () => new Audio());
    // Rehydrate last shared state + display mode, then listen for live GM pushes.
    void kvGet<BroadcastPayload>('broadcastState').then((saved) => {
      if (saved) payload = saved;
    });
    void kvGet<unknown>(DISPLAY_MODE_KEY).then((saved) => {
      mode = normalizeMode(saved);
    });
    void kvGet<unknown>(MOOD_KEY).then((saved) => {
      mood = normalizeMood(saved);
    });
    const bus = createBus();
    statusBus = bus; // reuse for the reverse audioStatus channel
    const off = bus.on((m) => {
      if (m.type === 'audioStatus') return; // our own reverse reports; ignore
      if (m.type === 'display') mode = m.mode;
      else if (m.type === 'mood') mood = moodById(m.moodId);
      else if (m.payload.kind === 'ping') flashPing(m.payload.x, m.payload.y);
      else if (m.payload.kind === 'laser')
        laser = m.payload.on ? { x: m.payload.x, y: m.payload.y } : null;
      else if (m.payload.kind === 'audio') handleAudio(m.payload);
      else {
        payload = m.payload;
        ytVideoFg = false; // new on-air content takes the foreground from the video
      }
    });
    return () => {
      off();
      bus.close();
      statusBus = null;
      clearTimeout(pingTimer);
      clearInterval(fadeTimer);
      for (const u of elUrl) if (u) URL.revokeObjectURL(u);
      for (const el of sfxPool) el.pause();
    };
  });
</script>

<div class="broadcast" class:plain={mode === 'plain'} style="filter:{mstyle.filter}">
  {#if payload.kind === 'text'}
    <div class="card">
      {#if payload.title}<h1>{payload.title}</h1>{/if}
      <p>{payload.body}</p>
    </div>
  {:else if payload.kind === 'image'}
    <figure>
      {#if imgSrc}<img src={imgSrc} alt={payload.caption ?? ''} />{/if}
      {#if payload.caption}<figcaption>{payload.caption}</figcaption>{/if}
    </figure>
  {:else if payload.kind === 'map'}
    {@const cols = payload.reveal[0]?.length ?? 0}
    {@const rows = payload.reveal.length}
    <!-- One shared world space (px). The `view` fragment sets the viewBox (fills
         the player window, ratio kept); the background is placed by its calibrated
         rect so image/grid/fog/tokens align with the GM. -->
    {@const vf = payload.view ?? { x: 0, y: 0, w: cols * CELL, h: rows * CELL }}
    <div class="mapview">
      <svg viewBox="{vf.x} {vf.y} {vf.w} {vf.h}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="bgrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path
              d="M {CELL} 0 L 0 0 0 {CELL}"
              fill="none"
              stroke="rgba(95,150,120,.22)"
              stroke-width="1"
            />
          </pattern>
        </defs>
        {#if mapSrc}
          {@const im = payload.img ?? { x: vf.x, y: vf.y, w: vf.w, h: vf.h }}
          <image
            href={mapSrc}
            x={im.x}
            y={im.y}
            width={im.w}
            height={im.h}
            preserveAspectRatio="none"
          />
        {/if}
        <!-- battle grid (1 cell = 1 metre) -->
        <rect x={vf.x} y={vf.y} width={vf.w} height={vf.h} fill="url(#bgrid)" />

        <!-- tokens (player-safe: position + label only) -->
        {#each payload.tokens ?? [] as tk, i (i)}
          {#if payload.reveal[tk.gy]?.[tk.gx] === 1}
            <g transform="translate({tk.gx * CELL} {tk.gy * CELL})">
              <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 4} fill={tk.color} />
              <text x={CELL / 2} y={CELL / 2 + 4} text-anchor="middle" class="tlbl">{tk.label}</text
              >
              {#each tk.conditions ?? [] as cid, j (cid)}
                <text x={CELL / 2} y={CELL + 12 + j * 13} text-anchor="middle" class="tcond">
                  {conditionGlyph(cid)}
                  {conditionMeta(cid)?.label ?? cid}
                </text>
              {/each}
            </g>
          {/if}
        {/each}

        {#each payload.reveal as fogRow, row (row)}
          {#each fogRow as cell, col (col)}
            {#if cell === 0}
              <!-- Hidden: fully opaque so players never see beyond the fog. -->
              <rect x={col * CELL} y={row * CELL} width={CELL} height={CELL} fill="#05090a" />
            {/if}
          {/each}
        {/each}
      </svg>
    </div>
  {:else if payload.kind === 'grid' && payload.cells.some((c) => c.area)}
    <!-- Stage: aspect-locked to the GM board (1280x800) so every cell has the
         same geometry and the laser/crops line up exactly with what the GM sees. -->
    <div class="stagebox">
      <div
        class="grid placed"
        style="grid-template-columns: repeat({payload.cols}, 1fr); grid-template-rows: repeat({payload.rows ??
          1}, 1fr)"
      >
        {#each payload.cells as cell, i (i)}
          {@const area = cell.area
            ? `grid-column:${cell.area.col} / span ${cell.area.cw}; grid-row:${cell.area.row} / span ${cell.area.rh}`
            : ''}
          {#if cell.kind === 'image'}
            {@const url = cell.assetId ? gridUrls[cell.assetId] : cell.src}
            <figure class="gcell" style={area}>
              {#if url}<img src={url} alt={cell.caption ?? ''} />{/if}
              {#if cell.caption}<figcaption>{cell.caption}</figcaption>{/if}
            </figure>
          {:else}
            <div class="gcell gtext" style={area}>
              {#if cell.title}<h2>{cell.title}</h2>{/if}
              {#if cell.body}<p>{cell.body}</p>{/if}
            </div>
          {/if}
        {/each}
      </div>
      {#if laser}
        <div class="laser" style="left:{laser.x * 100}%; top:{laser.y * 100}%"></div>
      {/if}
    </div>
  {:else if payload.kind === 'grid'}
    <div
      class="grid"
      style="grid-template-columns: repeat({clampCols(payload.cols, payload.cells.length)}, 1fr)"
    >
      {#each payload.cells as cell, i (i)}
        {#if cell.kind === 'image'}
          {@const url = cell.assetId ? gridUrls[cell.assetId] : cell.src}
          <figure class="gcell">
            {#if url}<img src={url} alt={cell.caption ?? ''} />{/if}
            {#if cell.caption}<figcaption>{cell.caption}</figcaption>{/if}
          </figure>
        {:else}
          <div class="gcell gtext">
            {#if cell.title}<h2>{cell.title}</h2>{/if}
            {#if cell.body}<p>{cell.body}</p>{/if}
          </div>
        {/if}
      {/each}
    </div>
  {:else if !youtubeId}
    <div class="idle">{t('broadcast.idle')}</div>
  {/if}

  <!-- Mood/lighting wash, layered over content but under transient markers. -->
  <div class="mood" style="background:{mstyle.overlay}"></div>

  {#if ping}
    <div class="ping" style="left:{ping.x * 100}%; top:{ping.y * 100}%"></div>
  {/if}

  {#if laser && !(payload.kind === 'grid' && payload.cells.some((c) => c.area))}
    <!-- Fallback dot for non-stage content (spotlight image/text): page fraction. -->
    <div class="laser" style="left:{laser.x * 100}%; top:{laser.y * 100}%"></div>
  {/if}

  {#if audioLocked}
    <button class="unlock" onclick={unlockAudio}>{t('broadcast.enableAudio')}</button>
  {/if}

  <!-- YouTube ambient embed (autoplay + loop). Muted fallback eases autoplay
       blocking; the keeper can unmute via YouTube's own controls. No JS seek. -->
  {#if youtubeId}
    {#key youtubeNonce}
      <!-- Audio-only: unmuted (so it's audible) but hidden offscreen. Visible:
           muted so autoplay isn't blocked; the keeper unmutes via YT controls. -->
      <iframe
        class="ytplayer"
        class:audioonly={ytBackground}
        title="Ambient YouTube"
        src="https://www.youtube-nocookie.com/embed/{youtubeId}?autoplay=1&loop=1&playlist={youtubeId}{youtubeAudioOnly &&
        !isPreview
          ? ''
          : '&mute=1'}"
        allow="autoplay"
        frameborder="0"
      ></iframe>
    {/key}
  {/if}

  <!-- Ambient element pair (A/B) for crossfade; hidden, GM-controlled via the bus.
       Ambient posts position/index back over the reverse channel for the transport.
       SFX play on a JS-created pool (not declared here) so shots can overlap. -->
  <audio
    bind:this={ambientA}
    ontimeupdate={() => onAmbientTimeUpdate(ambientA)}
    ondurationchange={() => postAmbientStatus(true)}
    onplay={() => postAmbientStatus(true)}
    onpause={() => postAmbientStatus(true)}
    onended={() => onAmbientEnded(ambientA)}
  ></audio>
  <audio
    bind:this={ambientB}
    ontimeupdate={() => onAmbientTimeUpdate(ambientB)}
    ondurationchange={() => postAmbientStatus(true)}
    onplay={() => postAmbientStatus(true)}
    onpause={() => postAmbientStatus(true)}
    onended={() => onAmbientEnded(ambientB)}
  ></audio>
</div>

<style>
  .broadcast {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 6vh 6vw;
    background: radial-gradient(120% 100% at 50% 0%, #0d1b16, #05090a 70%);
    color: var(--txt);
  }
  .idle {
    color: var(--faint);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 13px;
  }
  .card {
    max-width: 720px;
    text-align: center;
  }
  .card h1 {
    font-family: Georgia, serif;
    color: var(--green);
    font-size: clamp(28px, 5vw, 52px);
    margin-bottom: 18px;
  }
  .card p {
    font-size: clamp(16px, 2.4vw, 26px);
    line-height: 1.6;
  }
  figure {
    text-align: center;
  }
  figure img {
    max-width: 80vw;
    max-height: 70vh;
    border-radius: 12px;
    border: 1px solid var(--line2);
  }
  .mapview {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }
  .mapview svg {
    max-width: 86vw;
    max-height: 82vh;
    background: #0a1611;
    border-radius: 10px;
    border: 1px solid var(--line2);
  }
  .mapview .tlbl {
    fill: #06120c;
    font-size: 11px;
    font-weight: 700;
  }
  .mapview .tcond {
    fill: #eafff3;
    stroke: #05090a;
    stroke-width: 2.6;
    paint-order: stroke;
    stroke-linejoin: round;
    font-size: 10px;
    font-weight: 600;
  }
  figcaption {
    margin-top: 14px;
    color: var(--muted);
    font-style: italic;
  }

  .grid {
    display: grid;
    gap: 18px;
    width: 100%;
    max-width: 92vw;
    max-height: 84vh;
    align-content: center;
    justify-items: center;
  }
  /* Stage box: locked to the GM board's aspect ratio (1280x800) and fitted into
     the player window, so every cell has the same geometry as the GM board —
     identical crops and laser alignment. */
  .stagebox {
    position: relative;
    aspect-ratio: 1280 / 800;
    width: min(92vw, calc(84vh * 1280 / 800));
    max-height: 84vh;
  }
  .grid.placed {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    gap: 0;
    align-content: stretch;
    justify-items: stretch;
  }
  /* Mirror the GM tile: image covers the whole cell (same crop), caption overlays
     the bottom instead of taking flow space. */
  .grid.placed .gcell {
    position: relative;
    width: 100%;
    height: 100%;
    justify-content: center;
    overflow: hidden;
  }
  .grid.placed .gcell img {
    width: 100%;
    height: 100%;
    max-height: none;
    max-width: none;
    object-fit: cover;
  }
  .grid.placed .gcell figcaption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: 4px 8px;
    background: rgba(5, 9, 10, 0.6);
    color: #e9f3ed;
    font-style: normal;
    font-size: clamp(11px, 1.4vw, 18px);
  }
  .gcell {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
  }
  .gcell img {
    max-width: 100%;
    max-height: 60vh;
    border-radius: 10px;
    border: 1px solid var(--line2);
    object-fit: contain;
  }
  .gtext {
    text-align: center;
    padding: 8px 12px;
  }
  .gtext h2 {
    font-family: Georgia, serif;
    color: var(--green);
    font-size: clamp(18px, 2.6vw, 30px);
    margin-bottom: 8px;
  }
  .gtext p {
    font-size: clamp(13px, 1.7vw, 19px);
    line-height: 1.5;
  }

  .mood {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: background 0.8s ease;
    z-index: 1;
  }

  .ytplayer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    z-index: 2;
  }
  /* Sound-only: keep the iframe loaded/playing but invisible to players.
     Not display:none (that can stop playback) — push it offscreen at 1px. */
  .ytplayer.audioonly {
    inset: auto;
    left: -9999px;
    top: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

  .unlock {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    padding: 10px 18px;
    border-radius: 999px;
    border: 1px solid var(--green);
    background: rgba(9, 16, 13, 0.92);
    color: var(--green);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .unlock:hover {
    background: rgba(47, 138, 102, 0.2);
  }

  .ping {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border-radius: 50%;
    border: 3px solid var(--green);
    box-shadow: 0 0 18px var(--green);
    pointer-events: none;
    animation: pingpulse 1.5s ease-out forwards;
  }
  .laser {
    position: absolute;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 50%;
    background: radial-gradient(circle, #ff5a5a 0%, #ff2d2d 45%, rgba(255, 45, 45, 0) 72%);
    box-shadow: 0 0 14px 4px rgba(255, 45, 45, 0.7);
    pointer-events: none;
    z-index: 3;
    transition:
      left 0.05s linear,
      top 0.05s linear;
  }
  @keyframes pingpulse {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    25% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }

  /* Plain mode: flat, high-contrast framing for legibility over atmosphere. */
  .broadcast.plain {
    background: #05090a;
  }
  .broadcast.plain .card h1 {
    font-family: system-ui, sans-serif;
    color: var(--txt);
  }
  .broadcast.plain figure img,
  .broadcast.plain .gcell img {
    border-radius: 4px;
  }
  .broadcast.plain .gtext h2 {
    font-family: system-ui, sans-serif;
    color: var(--txt);
  }
  .broadcast.plain figcaption {
    font-style: normal;
  }
</style>
