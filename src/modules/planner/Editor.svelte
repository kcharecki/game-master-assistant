<script lang="ts">
  import { onMount } from 'svelte';
  import { planner } from './store.svelte';
  import {
    BEAT_TYPES,
    BEAT_STATUSES,
    type Beat,
    type BeatType,
    type BeatStatus,
    type Branch,
  } from './logic';
  import { putOnAir } from '../reveal/bus-actions';
  import { toast } from '../../lib/stores/toast.svelte';
  import { t } from '../../lib/i18n';
  import Empty from '../../lib/components/Empty.svelte';

  onMount(() => {
    void planner.load();
    const tick = setInterval(() => {
      if (mode === 'run') {
        beatSec += 1;
        sessionSec += 1;
      }
    }, 1000);
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(tick);
      window.removeEventListener('keydown', onKey);
    };
  });

  // ── surface state (ephemeral — the plan itself lives in the store) ──────────
  let mode = $state<'prep' | 'run'>('prep');
  let viz = $state<'outline' | 'map'>('outline');
  let beatSec = $state(0);
  let sessionSec = $state(0);
  let terminalNote = $state<string | null>(null);
  let broadcasted = $state<Record<string, boolean>>({});
  let showThreads = $state(false);

  const beats = $derived(planner.beats);
  const now = $derived(planner.current);

  // Reset the beat clock whenever the run cursor lands on a new beat.
  let lastCursor = planner.currentId;
  $effect(() => {
    if (planner.currentId !== lastCursor) {
      lastCursor = planner.currentId;
      beatSec = 0;
      terminalNote = null;
    }
  });

  // ── type palette ────────────────────────────────────────────────────────────
  const TYPE_COLOR: Record<BeatType, string> = {
    intro: '#6fae86',
    scene: '#7fb0c9',
    social: '#b58fc0',
    combat: '#c86a60',
    reveal: '#6cc0a8',
  };
  const GOLD = 'var(--gold)';
  const GREEN = 'var(--green)';
  const typeColor = (ty: BeatType) => TYPE_COLOR[ty] ?? TYPE_COLOR.scene;
  const typeLabel = (ty: BeatType) => t('planner.type.' + ty).toUpperCase();
  function statusFill(b: Beat): string {
    const c = typeColor(b.type);
    if (b.status === 'done') return c;
    if (b.status === 'draft') return `color-mix(in oklab, ${c} 40%, transparent)`;
    return 'transparent';
  }

  const ROW_H = 62;
  const indexOf = (id: string) => beats.findIndex((b) => b.id === id);

  interface BranchInfo {
    glyph: string;
    glyphColor: string;
    targetTitle: string;
    targetColor: string;
    isTerminal: boolean;
    isLoop: boolean;
    targetVal: string;
  }
  function branchInfo(srcIndex: number, br: Branch): BranchInfo {
    const tid = planner.branchTargetId(br.to);
    const tIdx = tid ? indexOf(tid) : -1;
    const target = tIdx >= 0 ? beats[tIdx] : undefined;
    const isTerminal = !target;
    const isLoop = !isTerminal && tIdx >= 0 && tIdx < srcIndex;
    return {
      glyph: isTerminal ? '◆' : isLoop ? '↩' : '→',
      glyphColor: isTerminal || isLoop ? GOLD : GREEN,
      targetTitle: isTerminal ? br.to || t('planner.terminalOutcome') : target!.title,
      targetColor: isTerminal ? GOLD : typeColor(target!.type),
      isTerminal,
      isLoop,
      targetVal: target ? target.title : '__terminal',
    };
  }

  // map arcs: one curved SVG path per branch that resolves to a beat.
  const arcs = $derived.by(() => {
    const out: { d: string; tip: string; color: string; dash: string }[] = [];
    beats.forEach((b, i) => {
      for (const br of b.branches) {
        const tid = planner.branchTargetId(br.to);
        const j = tid ? indexOf(tid) : -1;
        if (j < 0) continue;
        const y1 = i * ROW_H + ROW_H / 2;
        const y2 = j * ROW_H + ROW_H / 2;
        const depth = Math.min(30 + Math.abs(j - i) * 16, 118);
        const isLoop = j < i;
        out.push({
          d: `M 152 ${y1} C ${152 - depth} ${y1}, ${146 - depth} ${y2}, 146 ${y2}`,
          tip: `140,${y2 - 5} 140,${y2 + 5} 149,${y2}`,
          color: isLoop ? 'var(--gold)' : typeColor(beats[j].type),
          dash: isLoop ? '4 4' : 'none',
        });
      }
    });
    return out;
  });

  const totalTime = $derived.by(() => {
    const m = planner.plannedMins;
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  });
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  // ── actions ──────────────────────────────────────────────────────────────────
  function cycleStatus(b: Beat) {
    const i = BEAT_STATUSES.indexOf(b.status);
    planner.updateBeat(b.id, { status: BEAT_STATUSES[(i + 1) % BEAT_STATUSES.length] });
  }
  function startRun(id?: string) {
    if (id) planner.setCurrent(id);
    mode = 'run';
    beatSec = 0;
    terminalNote = null;
    showThreads = false;
  }
  function toPrep() {
    mode = 'prep';
    if (planner.currentId) planner.select(planner.currentId);
    showThreads = false;
  }
  function advance() {
    if (planner.next) {
      planner.step(1);
      terminalNote = null;
    } else {
      terminalNote = t('planner.endSpineNote');
    }
  }
  function takeBranch(br: Branch) {
    const tid = planner.branchTargetId(br.to);
    if (tid) {
      planner.jumpTo(tid);
      terminalNote = null;
    } else {
      terminalNote = br.to.trim() || t('planner.unresolved');
    }
  }
  function broadcast() {
    const b = planner.current;
    if (!b || !b.boxed.trim()) return;
    putOnAir({ kind: 'text', title: b.title, body: b.boxed.trim(), theme: 'parchment' });
    broadcasted = { ...broadcasted, [b.id]: true };
    toast.show(t('planner.pushedPlayer'));
  }

  function capture(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter' && el.value.trim()) {
      planner.addBeat(el.value.trim());
      el.value = '';
    }
  }
  function threadKey(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter' && el.value.trim()) {
      planner.addThread(el.value.trim());
      el.value = '';
    }
  }
  function setTarget(b: Beat, br: Branch, val: string) {
    if (val === '__terminal') planner.updateBranch(b.id, br.id, { to: t('planner.unresolved') });
    else planner.updateBranch(b.id, br.id, { to: val });
  }

  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (mode === 'run') {
      if (e.key === 'Escape') toPrep();
      else if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') planner.back();
      else if (e.key === 'b' || e.key === 'B') broadcast();
      else if (/^[1-9]$/.test(e.key)) {
        const br = (planner.current?.branches ?? [])[+e.key - 1];
        if (br) takeBranch(br);
      }
    } else if (e.key === 'Escape') {
      planner.select('');
      showThreads = false;
    }
  }

  const openThreadCount = $derived(planner.threads.filter((th) => !th.resolved).length);
  const runKeysHint = $derived(
    t('planner.runKeys')
      .replace('{n}', String((now?.branches.length ?? 0) || 1))
      .replace('{clock}', fmt(sessionSec)),
  );
</script>

<div class="sp">
  <!-- ── top bar ────────────────────────────────────────────────────────────── -->
  <div class="sp-bar">
    <span class="sp-diamond">◆</span>
    <input
      class="sp-camp"
      value={planner.campaign}
      oninput={(e) => (planner.campaign = e.currentTarget.value)}
      aria-label={t('planner.beatRail')}
    />
    <span class="sp-total">{totalTime} {t('planner.plannedTime')}</span>
    <span class="sp-spacer"></span>

    {#if mode === 'prep'}
      <div class="sp-seg">
        <button class="sp-segbtn" class:on={viz === 'outline'} onclick={() => (viz = 'outline')}
          >A · {t('planner.outline').toUpperCase()}</button
        >
        <button class="sp-segbtn" class:on={viz === 'map'} onclick={() => (viz = 'map')}
          >B · {t('planner.map').toUpperCase()}</button
        >
      </div>
    {/if}

    <button class="sp-threadsbtn" onclick={() => (showThreads = !showThreads)}
      >{t('planner.threadsN')} · {openThreadCount}</button
    >

    <div class="sp-seg gold">
      <button class="sp-segbtn" class:on={mode === 'prep'} onclick={toPrep}
        >{t('planner.prep').toUpperCase()}</button
      >
      <button class="sp-segbtn run" class:on={mode === 'run'} onclick={() => startRun()}
        >{t('planner.run').toUpperCase()}</button
      >
    </div>
  </div>

  {#if beats.length === 0}
    <div class="sp-empty"><Empty text={t('beats.none')} icon="edit" /></div>
  {:else if mode === 'prep'}
    <!-- ── PREP ─────────────────────────────────────────────────────────────── -->
    <div class="sp-prep">
      <div class="sp-flow">
        {#if viz === 'outline'}
          <div class="sp-outline">
            {#each beats as b, i (b.id)}
              {@const prevAct = i > 0 ? (beats[i - 1].act ?? '') : ''}
              {@const showAct = !!(b.act && b.act.trim() && b.act !== prevAct)}
              {@const sel = planner.selectedId === b.id}
              {@const live = planner.currentId === b.id}
              <div class="sp-beatwrap">
                {#if showAct}
                  <div class="sp-act">
                    <span class="sp-actlabel">{b.act}</span>
                    <span class="sp-actline"></span>
                  </div>
                {/if}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="sp-row" class:sel onclick={() => planner.select(sel ? '' : b.id)}>
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <span
                    class="sp-dot"
                    style:border-color={typeColor(b.type)}
                    style:background={statusFill(b)}
                    title={t('planner.status.' + b.status)}
                    onclick={(e) => {
                      e.stopPropagation();
                      cycleStatus(b);
                    }}
                  ></span>
                  <span class="sp-btitle" class:planned={b.status === 'planned'}>{b.title}</span>
                  {#if b.optional}<span class="sp-pill">{t('planner.skippable')}</span>{/if}
                  {#if live}<span class="sp-nowtag">● {t('planner.nowBadge')}</span>{/if}
                  <span class="sp-spacer"></span>
                  {#if b.cue}<span class="sp-cue">{b.cue}</span>{/if}
                  <span class="sp-mins">{b.mins ?? 0}m</span>
                  <button
                    class="sp-fork"
                    title={t('planner.forkTitle')}
                    aria-label={t('planner.forkTitle')}
                    onclick={(e) => {
                      e.stopPropagation();
                      planner.forkToNew(b.id);
                    }}>⑂</button
                  >
                  <button
                    class="sp-runbtn"
                    title={t('planner.runFromHere')}
                    aria-label={t('planner.runFromHere')}
                    onclick={(e) => {
                      e.stopPropagation();
                      startRun(b.id);
                    }}>▶</button
                  >
                </div>

                {#each b.branches as br (br.id)}
                  {@const bi = branchInfo(i, br)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="sp-branchline"
                    onclick={() => {
                      const tid = planner.branchTargetId(br.to);
                      if (tid) planner.select(tid);
                    }}
                  >
                    <span class="sp-bglyph" style:color={bi.glyphColor}>{bi.glyph}</span>
                    {#if br.cond}<span class="sp-bcond">{t('planner.branchIf')} {br.cond}</span
                      >{/if}
                    <span class="sp-btarget" style:color={bi.targetColor}>{bi.targetTitle}</span>
                    {#if bi.isLoop}<span class="sp-loop">{t('planner.loopsBack')}</span>{/if}
                  </div>
                {/each}

                {#if sel}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div class="sp-edit" onclick={(e) => e.stopPropagation()}>
                    <textarea
                      class="sp-readaloud"
                      rows="3"
                      placeholder={t('planner.readAloudPlaceholder')}
                      value={b.boxed}
                      oninput={(e) => planner.updateBeat(b.id, { boxed: e.currentTarget.value })}
                    ></textarea>
                    <textarea
                      class="sp-notes"
                      rows="2"
                      placeholder={t('planner.gmNotesPlaceholder')}
                      value={b.body}
                      oninput={(e) => planner.updateBeat(b.id, { body: e.currentTarget.value })}
                    ></textarea>
                    <div class="sp-editmeta">
                      <input
                        class="sp-cuein"
                        placeholder={t('planner.cuePlaceholder')}
                        value={b.cue ?? ''}
                        oninput={(e) => planner.updateBeat(b.id, { cue: e.currentTarget.value })}
                      />
                      <label class="sp-minsfield"
                        ><input
                          class="sp-minsin"
                          type="number"
                          min="0"
                          value={b.mins ?? ''}
                          oninput={(e) =>
                            planner.updateBeat(b.id, {
                              mins: e.currentTarget.value
                                ? Number(e.currentTarget.value)
                                : undefined,
                            })}
                        />{t('planner.minsHint')}</label
                      >
                      <select
                        class="sp-select"
                        value={b.type}
                        onchange={(e) =>
                          planner.updateBeat(b.id, { type: e.currentTarget.value as BeatType })}
                      >
                        {#each BEAT_TYPES as ty (ty)}<option value={ty}
                            >{t('planner.type.' + ty)}</option
                          >{/each}
                      </select>
                      <select
                        class="sp-select"
                        value={b.status}
                        onchange={(e) =>
                          planner.updateBeat(b.id, { status: e.currentTarget.value as BeatStatus })}
                      >
                        {#each BEAT_STATUSES as s (s)}<option value={s}
                            >{t('planner.status.' + s)}</option
                          >{/each}
                      </select>
                      <input
                        class="sp-actinput"
                        placeholder={t('planner.actHint')}
                        value={b.act ?? ''}
                        oninput={(e) => planner.updateBeat(b.id, { act: e.currentTarget.value })}
                      />
                      <button
                        class="sp-optbtn"
                        class:on={b.optional}
                        onclick={() => planner.toggleOptional(b.id)}
                        >{t('planner.skippable')}</button
                      >
                      <button class="sp-del" onclick={() => planner.removeBeat(b.id)}
                        >✕ {t('planner.deleteBeat')}</button
                      >
                    </div>

                    <div class="sp-brancheditor">
                      {#each b.branches as br (br.id)}
                        {@const bi = branchInfo(i, br)}
                        <div class="sp-brow">
                          <span class="sp-bglyph" style:color={bi.glyphColor}>{bi.glyph}</span>
                          <span class="sp-bif">{t('planner.branchIf')}</span>
                          <input
                            class="sp-bcondin"
                            placeholder={t('planner.playersDoWhat')}
                            value={br.cond}
                            oninput={(e) =>
                              planner.updateBranch(b.id, br.id, { cond: e.currentTarget.value })}
                          />
                          <span class="sp-barrow">→</span>
                          <select
                            class="sp-select sp-btargetsel"
                            value={bi.targetVal}
                            onchange={(e) => setTarget(b, br, e.currentTarget.value)}
                          >
                            {#each beats as opt (opt.id)}<option value={opt.title}
                                >{opt.title}</option
                              >{/each}
                            <option value="__terminal">◆ {t('planner.terminalOutcome')}</option>
                          </select>
                          <button class="sp-brdel" onclick={() => planner.removeBranch(b.id, br.id)}
                            >✕</button
                          >
                        </div>
                        {#if bi.isTerminal}
                          <input
                            class="sp-termin"
                            placeholder={t('planner.terminalHint')}
                            value={br.to}
                            oninput={(e) =>
                              planner.updateBranch(b.id, br.id, { to: e.currentTarget.value })}
                          />
                        {/if}
                      {/each}
                      <div class="sp-editactions">
                        <button class="sp-addbranch" onclick={() => planner.addBranch(b.id)}
                          >+ {t('planner.ifPlayersDo')}</button
                        >
                        <span class="sp-spacer"></span>
                        <button class="sp-runfrom" onclick={() => startRun(b.id)}
                          >▶ {t('planner.runFromHereBtn')}</button
                        >
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}

            <div class="sp-capture">
              <span class="sp-plus">+</span>
              <input
                class="sp-capturein"
                placeholder={t('planner.newBeatEnter')}
                onkeydown={capture}
              />
            </div>
          </div>
        {:else}
          <!-- ── MAP ────────────────────────────────────────────────────────── -->
          <div class="sp-map">
            <div class="sp-maphint">{t('planner.mapHint')}</div>
            <div class="sp-mapinner">
              <svg width="100%" height={beats.length * ROW_H} class="sp-svg" aria-hidden="true">
                <line
                  x1="160"
                  y1={ROW_H / 2}
                  x2="160"
                  y2={(beats.length - 1) * ROW_H + ROW_H / 2}
                  stroke="rgba(232,226,213,.14)"
                  stroke-width="2"
                />
                {#each arcs as arc (arc.d)}
                  <path
                    d={arc.d}
                    fill="none"
                    stroke={arc.color}
                    stroke-width="1.6"
                    stroke-dasharray={arc.dash}
                    opacity="0.85"
                  />
                  <polygon points={arc.tip} fill={arc.color} />
                {/each}
                {#each beats as b, i (b.id)}
                  <circle
                    cx="160"
                    cy={i * ROW_H + ROW_H / 2}
                    r="7"
                    fill={statusFill(b)}
                    stroke={typeColor(b.type)}
                    stroke-width="1.5"
                  />
                  {#if planner.currentId === b.id}
                    <circle
                      cx="160"
                      cy={i * ROW_H + ROW_H / 2}
                      r="12"
                      fill="none"
                      stroke="var(--gold)"
                      stroke-width="1"
                      class="sp-pulse"
                    />
                  {/if}
                {/each}
              </svg>
              <div class="sp-maprows">
                {#each beats as b (b.id)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="sp-maprow"
                    class:sel={planner.selectedId === b.id}
                    onclick={() => planner.select(b.id)}
                  >
                    <span class="sp-btitle" class:planned={b.status === 'planned'}>{b.title}</span>
                    <span class="sp-maptype" style:color={typeColor(b.type)}
                      >{typeLabel(b.type)}</span
                    >
                    {#if b.branches.some((br) => !planner.branchTargetId(br.to))}
                      <span class="sp-deadend">◆ {t('planner.deadEnds')}</span>
                    {/if}
                    {#if planner.currentId === b.id}<span class="sp-nowtag"
                        >● {t('planner.nowBadge')}</span
                      >{/if}
                    <span class="sp-spacer"></span>
                    <span class="sp-mins">{b.mins ?? 0}m</span>
                  </div>
                {/each}
              </div>
            </div>
            <div class="sp-capture map">
              <span class="sp-plus">+</span>
              <input
                class="sp-capturein"
                placeholder={t('planner.newBeatEnterShort')}
                onkeydown={capture}
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- right rail -->
      <aside class="sp-rail">
        {#if viz === 'map' && planner.selected}
          {@const d = planner.selected}
          {@const di = indexOf(d.id)}
          <div class="sp-detail">
            <div class="sp-detitle">{d.title}</div>
            <div class="sp-detmeta" style:color={typeColor(d.type)}>
              {typeLabel(d.type)} · {d.mins ?? 0}M
            </div>
            {#if d.boxed.trim()}
              <div class="sp-deread">{d.boxed.slice(0, 160)}{d.boxed.length > 160 ? '…' : ''}</div>
            {/if}
            {#each d.branches as br (br.id)}
              {@const bi = branchInfo(di, br)}
              <div class="sp-debranch">
                <span class="sp-bglyph" style:color={bi.glyphColor}>{bi.glyph}</span>
                <span
                  >{t('planner.branchIf')}
                  {br.cond} —
                  <span class="sp-detarget" style:color={bi.targetColor}>{bi.targetTitle}</span
                  ></span
                >
              </div>
            {/each}
            <div class="sp-deact">
              <button class="sp-deedit" onclick={() => (viz = 'outline')}
                >{t('planner.editInOutline')}</button
              >
              <button class="sp-derun" onclick={() => startRun(d.id)}>▶ {t('planner.run')}</button>
            </div>
          </div>
        {/if}
        <div class="sp-threadsrail">
          <div class="sp-threadhd">{t('planner.openThreads')}</div>
          {#each planner.threads as th (th.id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="sp-thread" onclick={() => planner.toggleThread(th.id)}>
              <span class="sp-thdot" class:res={th.resolved}></span>
              <span class="sp-thtext" class:res={th.resolved}>{th.text}</span>
            </div>
          {/each}
          <input
            class="sp-threadin"
            placeholder={t('planner.openQuestion')}
            onkeydown={threadKey}
          />
        </div>
      </aside>
    </div>
  {:else if now}
    <!-- ── RUN cockpit ──────────────────────────────────────────────────────── -->
    <div class="sp-run">
      <div class="sp-runinner">
        <div class="sp-runhead">
          <span class="sp-runnow">● {t('planner.nowBadge')}</span>
          <span class="sp-runtype" style:color={typeColor(now.type)}>{typeLabel(now.type)}</span>
          {#if now.act}<span class="sp-runact">{now.act}</span>{/if}
          <span class="sp-spacer"></span>
          <span class="sp-runclock" class:over={beatSec > (now.mins ?? 0) * 60}
            >{fmt(beatSec)} <span class="sp-of">of {now.mins ?? 0}m</span></span
          >
        </div>

        <div class="sp-runtitle">{now.title}</div>

        {#if now.boxed.trim()}
          <div class="sp-runbox">
            <div class="sp-runread">{now.boxed}</div>
            <div class="sp-runbcast">
              <button class="sp-bcastbtn" onclick={broadcast}
                >⇡ {t('planner.broadcastPlayers')} <span class="sp-key">· B</span></button
              >
              {#if broadcasted[now.id]}<span class="sp-livelbl"
                  >● {t('planner.livePlayerScreen')}</span
                >{/if}
            </div>
          </div>
        {/if}

        {#if now.cue}<div class="sp-runcue">☞ {now.cue}</div>{/if}
        {#if now.body.trim()}<div class="sp-runnotes">{now.body}</div>{/if}

        {#if terminalNote}
          <div class="sp-terminal">
            <span class="sp-tdiamond">◆</span>
            <span class="sp-tnote">{terminalNote} — {t('planner.loggedContinue')}.</span>
            <button class="sp-tcontinue" onclick={advance}>{t('planner.continueSpine')}</button>
          </div>
        {/if}

        <div class="sp-choices">
          {#each now.branches as br, j (br.id)}
            {@const bi = branchInfo(indexOf(now.id), br)}
            <button class="sp-choice" onclick={() => takeBranch(br)}>
              <span class="sp-choicenum">{j + 1}</span>
              <span class="sp-choicebody">
                <span class="sp-choicecond">{t('planner.branchIf')} {br.cond}</span>
                <span class="sp-choicetarget" style:color={bi.targetColor}
                  >{bi.glyph}
                  {bi.targetTitle}{#if bi.isLoop}<span class="sp-loop"
                      >{t('planner.loopsBack')}</span
                    >{/if}</span
                >
              </span>
            </button>
          {/each}
        </div>

        <span class="sp-spacer"></span>

        <div class="sp-runbottom">
          <button class="sp-backbtn" disabled={!planner.canBack} onclick={() => planner.back()}
            >← {t('planner.back')}</button
          >
          <span class="sp-nextpeek"
            >{t('planner.upNext')} ·
            <span class="sp-nexttitle">{planner.next?.title ?? t('planner.endOfSpine')}</span></span
          >
          <button class="sp-advance" onclick={advance}>{t('planner.advance')}</button>
        </div>
        <div class="sp-runkeys">{runKeysHint}</div>
      </div>
    </div>
  {/if}

  <!-- threads overlay -->
  {#if showThreads}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="sp-scrim" onclick={() => (showThreads = false)}></div>
    <div class="sp-threadspanel">
      <div class="sp-panelhd">
        <span class="sp-paneltitle">{t('planner.openThreads')}</span>
        <span class="sp-spacer"></span>
        <button class="sp-panelclose" onclick={() => (showThreads = false)}>✕</button>
      </div>
      {#each planner.threads as th (th.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="sp-thread" onclick={() => planner.toggleThread(th.id)}>
          <span class="sp-thdot" class:res={th.resolved}></span>
          <span class="sp-thtext" class:res={th.resolved}>{th.text}</span>
        </div>
      {/each}
      <input class="sp-threadin" placeholder={t('planner.openQuestion')} onkeydown={threadKey} />
    </div>
  {/if}
</div>

<style>
  .sp {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--txt);
    font-size: 15px;
    container-type: inline-size;
  }
  .sp-spacer {
    flex: 1;
  }

  /* top bar */
  .sp-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 22px;
    height: 54px;
    flex: none;
    border-bottom: 1px solid var(--line);
  }
  .sp-diamond {
    color: var(--gold);
    font-size: 12px;
  }
  .sp-camp {
    background: transparent;
    border: none;
    color: var(--txt);
    font-family: var(--serif);
    font-size: 20px;
    font-weight: 500;
    padding: 2px 4px;
    border-radius: 4px;
    width: 16ch;
  }
  .sp-camp:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.25);
  }
  .sp-total {
    font-size: 12px;
    color: var(--muted);
  }
  .sp-seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--line2);
    border-radius: 999px;
  }
  .sp-seg.gold {
    border-color: rgba(214, 182, 94, 0.3);
  }
  .sp-segbtn {
    border: none;
    cursor: pointer;
    border-radius: 999px;
    padding: 5px 15px;
    font-size: 11px;
    letter-spacing: 0.12em;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 11px;
  }
  .sp-segbtn.on {
    background: rgba(232, 226, 213, 0.12);
    color: var(--txt);
  }
  .sp-seg.gold .sp-segbtn {
    color: var(--gold);
  }
  .sp-seg.gold .sp-segbtn.on {
    background: var(--gold);
    color: #14110a;
    font-weight: 700;
  }
  .sp-threadsbtn {
    border: 1px solid var(--line2);
    background: transparent;
    cursor: pointer;
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 12px;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
  }
  .sp-threadsbtn:hover {
    color: var(--txt);
    border-color: var(--green-dim);
  }
  .sp-empty {
    flex: 1;
    display: grid;
    place-items: center;
  }

  /* prep layout */
  .sp-prep {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .sp-flow {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 26px 40px 100px 44px;
  }
  .sp-outline {
    max-width: 760px;
  }

  .sp-act {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 26px 0 12px;
  }
  .sp-actlabel {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--gold);
    opacity: 0.85;
  }
  .sp-actline {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(214, 182, 94, 0.25), transparent);
  }

  .sp-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 9px 12px;
    margin-left: -12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .sp-row:hover {
    background: rgba(232, 226, 213, 0.04);
  }
  .sp-row.sel {
    background: rgba(214, 182, 94, 0.05);
  }
  .sp-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid;
    flex: none;
    align-self: center;
    cursor: pointer;
  }
  .sp-btitle {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 500;
    color: #e8e2d5;
  }
  .sp-btitle.planned {
    color: #c9c2b2;
  }
  .sp-pill {
    font-size: 11px;
    color: var(--faint);
    border: 1px solid var(--line2);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .sp-nowtag {
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--gold);
  }
  .sp-cue {
    font-size: 12px;
    color: var(--faint);
    font-style: italic;
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-mins {
    font-size: 12px;
    color: var(--muted);
    flex: none;
  }
  .sp-fork,
  .sp-runbtn {
    border: 1px solid;
    background: transparent;
    border-radius: 6px;
    padding: 2px 9px;
    cursor: pointer;
    flex: none;
    font: inherit;
  }
  .sp-fork {
    border-color: var(--green-dim);
    color: var(--green);
    font-size: 13px;
  }
  .sp-fork:hover {
    background: rgba(79, 163, 123, 0.12);
  }
  .sp-runbtn {
    border-color: rgba(214, 182, 94, 0.3);
    color: var(--gold);
    font-size: 11px;
  }
  .sp-runbtn:hover {
    background: rgba(214, 182, 94, 0.12);
  }

  .sp-branchline {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 3px 0 3px 46px;
    cursor: pointer;
  }
  .sp-branchline:hover {
    background: rgba(232, 226, 213, 0.03);
  }
  .sp-bglyph {
    font-size: 13px;
    flex: none;
    width: 16px;
    text-align: center;
  }
  .sp-bcond {
    font-size: 13px;
    color: var(--muted);
  }
  .sp-btarget {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
  }
  .sp-loop {
    font-size: 10px;
    color: var(--gold);
    opacity: 0.7;
    letter-spacing: 0.1em;
    margin-left: 8px;
  }

  /* inline editor */
  .sp-edit {
    margin: 8px 0 16px 34px;
    padding: 16px 18px;
    border: 1px solid rgba(214, 182, 94, 0.16);
    border-radius: 12px;
    background: rgba(214, 182, 94, 0.03);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sp-readaloud,
  .sp-notes {
    background: transparent;
    border: none;
    width: 100%;
    resize: vertical;
    font: inherit;
  }
  .sp-readaloud {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.55;
    color: var(--gold);
  }
  .sp-notes {
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }
  .sp-readaloud:focus,
  .sp-notes:focus {
    outline: none;
  }
  .sp-editmeta {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }
  .sp-cuein {
    flex: 1;
    min-width: 200px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line2);
    padding: 4px 0;
    font-size: 13px;
    font-style: italic;
    color: #c9c2b2;
    font-family: inherit;
  }
  .sp-cuein:focus {
    outline: none;
    border-bottom-color: rgba(214, 182, 94, 0.5);
  }
  .sp-minsfield {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .sp-minsin {
    width: 52px;
    background: rgba(232, 226, 213, 0.05);
    border: 1px solid var(--line2);
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 13px;
    color: var(--txt);
    font-family: inherit;
  }
  .sp-select {
    background: rgba(232, 226, 213, 0.05);
    border: 1px solid var(--line2);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--txt);
    font-family: inherit;
  }
  .sp-actinput {
    flex: 1;
    min-width: 90px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line2);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--muted);
    font-family: inherit;
  }
  .sp-optbtn {
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--faint);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .sp-optbtn.on {
    color: var(--gold);
    border-color: rgba(214, 182, 94, 0.4);
  }
  .sp-del {
    border: none;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .sp-del:hover {
    color: #c96f4a;
  }
  .sp-brancheditor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sp-brow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sp-bif {
    font-size: 12px;
    color: var(--faint);
    flex: none;
  }
  .sp-bcondin {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line);
    padding: 3px 0;
    font-size: 13px;
    color: #c9c2b2;
    font-family: inherit;
  }
  .sp-bcondin:focus {
    outline: none;
    border-bottom-color: var(--green-dim);
  }
  .sp-barrow {
    font-size: 12px;
    color: var(--faint);
    flex: none;
  }
  .sp-btargetsel {
    max-width: 210px;
  }
  .sp-brdel {
    border: none;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font: inherit;
  }
  .sp-brdel:hover {
    color: #c96f4a;
  }
  .sp-termin {
    margin-left: 24px;
    background: transparent;
    border: none;
    border-bottom: 1px dashed rgba(214, 182, 94, 0.3);
    padding: 3px 0;
    font-size: 13px;
    font-style: italic;
    color: var(--gold);
    font-family: inherit;
  }
  .sp-termin:focus {
    outline: none;
  }
  .sp-editactions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .sp-addbranch {
    border: 1px dashed var(--green-dim);
    background: transparent;
    color: var(--green);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .sp-addbranch:hover {
    background: rgba(79, 163, 123, 0.1);
  }
  .sp-runfrom {
    border: 1px solid rgba(214, 182, 94, 0.4);
    background: rgba(214, 182, 94, 0.08);
    color: var(--gold);
    border-radius: 6px;
    padding: 5px 14px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0.08em;
  }
  .sp-runfrom:hover {
    background: rgba(214, 182, 94, 0.16);
  }

  .sp-capture {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 20px;
    padding-left: 12px;
  }
  .sp-capture.map {
    margin-left: 190px;
    padding-left: 0;
  }
  .sp-plus {
    color: var(--green);
    font-size: 16px;
  }
  .sp-capturein {
    flex: 1;
    background: transparent;
    border: none;
    font-family: var(--serif);
    font-size: 20px;
    color: #e8e2d5;
    padding: 8px 0;
  }
  .sp-capturein:focus {
    outline: none;
  }

  /* map */
  .sp-map {
    max-width: 820px;
  }
  .sp-maphint {
    font-size: 12px;
    color: var(--faint);
    margin: 0 0 18px 190px;
    font-style: italic;
  }
  .sp-mapinner {
    position: relative;
  }
  .sp-svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .sp-maprows {
    position: relative;
  }
  .sp-maprow {
    height: 62px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-left: 190px;
    padding: 0 14px;
    border-radius: 8px;
    cursor: pointer;
  }
  .sp-maprow:hover {
    background: rgba(232, 226, 213, 0.04);
  }
  .sp-maprow.sel {
    background: rgba(214, 182, 94, 0.05);
  }
  .sp-maptype {
    font-size: 11px;
    letter-spacing: 0.1em;
  }
  .sp-deadend {
    font-size: 11px;
    color: var(--gold);
    opacity: 0.7;
  }
  .sp-pulse {
    animation: sp-pulse 2s ease infinite;
  }
  @keyframes sp-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* right rail */
  .sp-rail {
    width: 300px;
    flex: none;
    border-left: 1px solid var(--line);
    padding: 28px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 26px;
  }
  .sp-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 22px;
    border-bottom: 1px solid var(--line);
  }
  .sp-detitle {
    font-family: var(--serif);
    font-size: 24px;
    font-weight: 500;
    color: #e8e2d5;
  }
  .sp-detmeta {
    font-size: 11px;
    letter-spacing: 0.1em;
  }
  .sp-deread {
    font-family: var(--serif);
    font-style: italic;
    font-size: 15px;
    line-height: 1.55;
    color: var(--gold);
    opacity: 0.9;
  }
  .sp-debranch {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 12.5px;
    color: var(--muted);
  }
  .sp-detarget {
    font-style: italic;
  }
  .sp-deact {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .sp-deedit {
    border: 1px solid var(--green-dim);
    background: transparent;
    color: var(--green);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .sp-derun {
    border: 1px solid rgba(214, 182, 94, 0.4);
    background: rgba(214, 182, 94, 0.08);
    color: var(--gold);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .sp-threadsrail {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sp-threadhd {
    font-family: var(--serif);
    font-style: italic;
    font-size: 17px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .sp-thread {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 7px 0;
    cursor: pointer;
  }
  .sp-thread:hover {
    opacity: 0.85;
  }
  .sp-thdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--green);
    background: transparent;
    flex: none;
    align-self: center;
  }
  .sp-thdot.res {
    background: var(--green);
  }
  .sp-thtext {
    font-size: 13.5px;
    line-height: 1.45;
    color: #c9c2b2;
  }
  .sp-thtext.res {
    color: var(--faint);
    text-decoration: line-through;
  }
  .sp-threadin {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line);
    padding: 7px 0;
    font-size: 13px;
    color: #c9c2b2;
    margin-top: 8px;
    font-family: inherit;
  }
  .sp-threadin:focus {
    outline: none;
    border-bottom-color: var(--green-dim);
  }

  /* run cockpit */
  .sp-run {
    flex: 1;
    display: flex;
    justify-content: center;
    min-height: 0;
    overflow-y: auto;
    background: radial-gradient(
      ellipse 80% 60% at 50% 0%,
      rgba(214, 182, 94, 0.045),
      transparent 70%
    );
  }
  .sp-runinner {
    width: 100%;
    max-width: 920px;
    padding: 40px 36px 30px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    flex: 1;
  }
  .sp-runhead {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }
  .sp-runnow {
    font-size: 11px;
    letter-spacing: 0.3em;
    color: var(--gold);
    animation: sp-pulse 2.4s ease infinite;
  }
  .sp-runtype {
    font-size: 11px;
    letter-spacing: 0.12em;
  }
  .sp-runact {
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--faint);
  }
  .sp-runclock {
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .sp-runclock.over {
    color: #c96f4a;
  }
  .sp-of {
    color: var(--faint);
  }
  .sp-runtitle {
    font-family: var(--serif);
    font-size: 54px;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: #f0e7cf;
  }
  .sp-runbox {
    padding: 18px 22px;
    border: 1px solid rgba(214, 182, 94, 0.18);
    border-radius: 14px;
    background: rgba(214, 182, 94, 0.035);
  }
  .sp-runread {
    font-family: var(--serif);
    font-style: italic;
    font-size: 24px;
    line-height: 1.55;
    color: var(--gold);
  }
  .sp-runbcast {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 14px;
  }
  .sp-bcastbtn {
    border: 1px solid rgba(79, 163, 123, 0.4);
    background: transparent;
    color: var(--green);
    border-radius: 999px;
    padding: 6px 16px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0.08em;
  }
  .sp-bcastbtn:hover {
    background: rgba(79, 163, 123, 0.12);
  }
  .sp-key {
    opacity: 0.6;
  }
  .sp-livelbl {
    font-size: 12px;
    color: var(--green);
  }
  .sp-runcue {
    font-size: 16px;
    font-style: italic;
    color: var(--gold);
    opacity: 0.85;
  }
  .sp-runnotes {
    font-size: 14px;
    line-height: 1.55;
    color: var(--muted);
    max-width: 640px;
    white-space: pre-wrap;
  }
  .sp-terminal {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 22px;
    border: 1px solid rgba(214, 182, 94, 0.45);
    border-radius: 12px;
    background: rgba(214, 182, 94, 0.07);
  }
  .sp-tdiamond {
    color: var(--gold);
    font-size: 16px;
  }
  .sp-tnote {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--gold);
    flex: 1;
  }
  .sp-tcontinue {
    border: 1px solid rgba(214, 182, 94, 0.4);
    background: transparent;
    color: var(--gold);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .sp-choices {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sp-choice {
    display: flex;
    align-items: center;
    gap: 20px;
    text-align: left;
    min-height: 80px;
    padding: 18px 22px;
    border: 1px solid var(--line2);
    border-radius: 14px;
    background: rgba(232, 226, 213, 0.025);
    cursor: pointer;
    transition: all 0.15s ease;
    font: inherit;
    color: var(--txt);
  }
  .sp-choice:hover {
    border-color: rgba(214, 182, 94, 0.5);
    background: rgba(214, 182, 94, 0.05);
    transform: translateY(-1px);
  }
  .sp-choicenum {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1px solid var(--line2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: var(--muted);
    flex: none;
  }
  .sp-choicebody {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }
  .sp-choicecond {
    font-size: 14px;
    color: var(--muted);
  }
  .sp-choicetarget {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 500;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .sp-runbottom {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 18px 0 10px;
    border-top: 1px solid var(--line);
  }
  .sp-backbtn {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    padding: 10px 14px;
  }
  .sp-backbtn:hover:not(:disabled) {
    color: var(--txt);
  }
  .sp-backbtn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .sp-nextpeek {
    flex: 1;
    text-align: center;
    font-size: 13px;
    color: var(--faint);
  }
  .sp-nexttitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: 15px;
    color: var(--muted);
  }
  .sp-advance {
    border: 1px solid rgba(214, 182, 94, 0.45);
    background: rgba(214, 182, 94, 0.08);
    color: var(--gold);
    border-radius: 10px;
    padding: 12px 26px;
    cursor: pointer;
    font: inherit;
    font-size: 15px;
    letter-spacing: 0.06em;
  }
  .sp-advance:hover {
    background: rgba(214, 182, 94, 0.16);
  }
  .sp-runkeys {
    text-align: center;
    font-size: 11px;
    color: var(--faint);
    padding-bottom: 8px;
  }

  /* threads overlay */
  .sp-scrim {
    position: absolute;
    inset: 0;
    background: rgba(8, 7, 5, 0.5);
    z-index: 40;
  }
  .sp-threadspanel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    background: var(--panel);
    border-left: 1px solid rgba(214, 182, 94, 0.15);
    padding: 26px;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
  }
  .sp-panelhd {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 12px;
  }
  .sp-paneltitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: 20px;
    color: var(--gold);
  }
  .sp-panelclose {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 15px;
  }

  @container (max-width: 720px) {
    .sp-prep {
      flex-direction: column;
      overflow-y: auto;
    }
    .sp-rail {
      width: auto;
      border-left: none;
      border-top: 1px solid var(--line);
    }
    .sp-flow {
      padding: 20px 20px 40px;
    }
  }
</style>
