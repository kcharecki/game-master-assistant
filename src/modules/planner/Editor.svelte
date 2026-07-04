<script lang="ts">
  import { onMount } from 'svelte';
  import { planner } from './store.svelte';
  import { beatRefs, BEAT_TYPES, BEAT_STATUSES, type BeatType, type BeatStatus } from './logic';
  import { renderMarkdown } from '../notebook/logic';
  import { putOnAir } from '../reveal/bus-actions';
  import { toast } from '../../lib/stores/toast.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';
  import FlowMap from './FlowMap.svelte';
  import RunWidget from './Desktop.svelte';

  onMount(() => void planner.load());

  let mode = $state<'editor' | 'run'>('editor');
  let collapseDone = $state(false);
  let newBeatTitle = $state('');
  let newThreadText = $state('');
  let dragId = $state<string | null>(null);
  let overId = $state<string | null>(null);

  const refs = $derived(planner.selected ? beatRefs(planner.selected.body) : []);
  const bodyHtml = $derived(
    planner.selected?.body.trim() ? renderMarkdown(planner.selected.body, { wikilink: true }) : ''
  );

  function addBeat() {
    if (!newBeatTitle.trim()) return;
    planner.addBeat(newBeatTitle);
    newBeatTitle = '';
  }

  function addThread() {
    if (!newThreadText.trim()) return;
    planner.addThread(newThreadText);
    newThreadText = '';
  }

  // Route @npc / [[lore]] chips to their module via the shared jump event.
  function jump(name: string) {
    window.dispatchEvent(new CustomEvent('notebook:wikilink', { detail: { name } }));
  }

  // Send a beat's read-aloud text to the shared broadcast window as parchment.
  function pushToStage() {
    const beat = planner.selected;
    if (!beat || !beat.boxed.trim()) return;
    putOnAir({ kind: 'text', title: beat.title, body: beat.boxed.trim(), theme: 'parchment' });
    toast.show(t('planner.pushed'));
  }

  function onBodyClick(e: MouseEvent) {
    const wiki = (e.target as HTMLElement).closest('a[data-wiki]') as HTMLAnchorElement | null;
    if (wiki) {
      e.preventDefault();
      jump(wiki.dataset.wiki ?? '');
    }
  }

  function onDrop(toId: string) {
    if (dragId && dragId !== toId) planner.reorder(dragId, toId);
    dragId = null;
    overId = null;
  }
</script>

<div class="pe">
  <div class="pe-bar">
    <span class="pe-dots"><i></i><i></i><i></i></span>
    <input
      class="pe-campaign"
      value={planner.campaign}
      oninput={(e) => (planner.campaign = e.currentTarget.value)}
      aria-label={t('planner.beatRail')}
    />
    <span class="pe-sep">·</span>
    <input
      class="pe-session"
      value={planner.session}
      oninput={(e) => (planner.session = e.currentTarget.value)}
    />
    <span class="pe-count">{planner.beats.length}</span>
    <button
      class="pe-reset"
      title={t('planner.resetSample')}
      aria-label={t('planner.resetSample')}
      onclick={() => planner.reset()}>↺</button
    >
    <div class="pe-modes">
      <button class="pe-mode" class:on={mode === 'editor'} onclick={() => (mode = 'editor')}
        >{t('planner.editor')}</button
      >
      <button class="pe-mode" class:on={mode === 'run'} onclick={() => (mode = 'run')}
        >{t('planner.run')}</button
      >
    </div>
  </div>

  {#if mode === 'run'}
    <div class="pe-runhost"><RunWidget /></div>
  {:else}
    <div class="pe-scroll">
      <div class="pe-railhead">
        <span class="pe-rlab"
          >{t('planner.beatRail')} · {planner.beats.length} {t('planner.beatsN')}</span
        >
        <label class="pe-toggle">
          <input type="checkbox" bind:checked={collapseDone} />
          {t('planner.collapseDone')}
        </label>
      </div>

      {#each planner.acts as group (group.act || '_')}
        {#if group.act}<div class="pe-act">{group.act}</div>{/if}
        {#each group.beats as b (b.id)}
          {@const isDone = b.status === 'done'}
          {#if !(collapseDone && isDone && b.id !== planner.selectedId)}
            <div
              class="pe-beat {b.type}"
              class:sel={b.id === planner.selectedId}
              class:cur={b.id === planner.currentId}
              class:done={isDone}
              class:over={overId === b.id}
              role="listitem"
              ondragover={(e) => {
                e.preventDefault();
                overId = b.id;
              }}
              ondragleave={() => overId === b.id && (overId = null)}
              ondrop={() => onDrop(b.id)}
            >
              <div class="pe-row">
                <span
                  class="pe-handle"
                  draggable="true"
                  role="button"
                  tabindex="-1"
                  aria-label={t('planner.reorder')}
                  title={t('planner.reorder')}
                  ondragstart={() => (dragId = b.id)}
                  ondragend={() => {
                    dragId = null;
                    overId = null;
                  }}>⠿</span
                >
                <button
                  class="pe-check"
                  class:on={isDone}
                  title={t('planner.toggleDone')}
                  aria-label={t('planner.toggleDone')}
                  onclick={() => planner.toggleDone(b.id)}>{isDone ? '✓' : '○'}</button
                >
                {#if b.id === planner.selectedId}
                  {#if b.id === planner.currentId}<span class="pe-livebadge">▸ {t('planner.live')}</span>{/if}
                  <input
                    class="pe-titlein"
                    value={b.title}
                    oninput={(e) => planner.updateBeat(b.id, { title: e.currentTarget.value })}
                  />
                {:else}
                  <button class="pe-title" onclick={() => planner.select(b.id)}>{b.title}</button>
                {/if}
                <span class="pe-type {b.type}">{t('planner.type.' + b.type)}</span>
                {#if b.id !== planner.selectedId}
                  <span class="pe-status {b.status}">{t('planner.status.' + b.status)}</span>
                {/if}
                <button
                  class="pe-caret"
                  aria-label={b.id === planner.selectedId ? t('notebook.collapse') : t('notebook.expand')}
                  onclick={() => planner.select(b.id === planner.selectedId ? '' : b.id)}
                  >{b.id === planner.selectedId ? '▾' : '▸'}</button
                >
              </div>

              {#if b.id === planner.selectedId}
                <div class="pe-detail">
                  <div class="pe-meta">
                    <select
                      class="pe-select"
                      value={b.type}
                      onchange={(e) =>
                        planner.updateBeat(b.id, { type: e.currentTarget.value as BeatType })}
                    >
                      {#each BEAT_TYPES as ty (ty)}<option value={ty}>{t('planner.type.' + ty)}</option>{/each}
                    </select>
                    <select
                      class="pe-select"
                      value={b.status}
                      onchange={(e) =>
                        planner.updateBeat(b.id, { status: e.currentTarget.value as BeatStatus })}
                    >
                      {#each BEAT_STATUSES as s (s)}<option value={s}>{t('planner.status.' + s)}</option
                        >{/each}
                    </select>
                    <input
                      class="pe-actin"
                      placeholder={t('planner.actHint')}
                      value={b.act ?? ''}
                      oninput={(e) => planner.updateBeat(b.id, { act: e.currentTarget.value })}
                    />
                    <button
                      class="pe-mini set"
                      class:on={b.id === planner.currentId}
                      title={t('planner.markCurrent')}
                      aria-label={t('planner.markCurrent')}
                      onclick={() => planner.setCurrent(b.id)}>◉</button
                    >
                    <button
                      class="pe-mini danger"
                      title={t('beats.removeBeat')}
                      aria-label={t('beats.removeBeat')}
                      onclick={() => planner.removeBeat(b.id)}><Icon name="trash" size={13} /></button
                    >
                  </div>

                  <div class="pe-field">
                    <span class="pe-flab">
                      {t('planner.readAloud')} <span class="pe-sub">· {t('planner.playerFacing')}</span>
                      <button
                        class="pe-cast"
                        disabled={!b.boxed.trim()}
                        title={t('planner.broadcast')}
                        onclick={pushToStage}>⤒ {t('planner.broadcast')}</button
                      >
                    </span>
                    <textarea
                      class="pe-boxed"
                      rows="3"
                      placeholder={t('planner.readAloudHint')}
                      value={b.boxed}
                      oninput={(e) => planner.updateBeat(b.id, { boxed: e.currentTarget.value })}
                    ></textarea>
                  </div>

                  <div class="pe-field">
                    <span class="pe-flab"
                      >{t('planner.gmNotes')} <span class="pe-sub">· {t('planner.yourEyes')}</span></span
                    >
                    <textarea
                      class="pe-notes"
                      rows="3"
                      placeholder={t('planner.gmNotesHint')}
                      value={b.body}
                      oninput={(e) => planner.updateBeat(b.id, { body: e.currentTarget.value })}
                    ></textarea>
                    {#if bodyHtml}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input; only our own tags are re-added -->
                      <div class="pe-preview" onclick={onBodyClick}>{@html bodyHtml}</div>
                    {/if}
                  </div>

                  {#if refs.length}
                    <div class="pe-field">
                      <span class="pe-flab">{t('planner.references')}</span>
                      <div class="pe-refs">
                        {#each refs as r (r.kind + r.name)}
                          <button class="pe-chip" class:npc={r.kind === 'npc'} onclick={() => jump(r.name)}>
                            <span class="pe-rk">{r.kind === 'npc' ? '@' : '[[]]'}</span>
                            {r.name}
                            <Icon name="open" size={11} />
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <div class="pe-field">
                    <span class="pe-flab">{t('planner.runCue')}</span>
                    <input
                      class="pe-cuein"
                      placeholder={t('planner.runCueHint')}
                      value={b.cue ?? ''}
                      oninput={(e) => planner.updateBeat(b.id, { cue: e.currentTarget.value })}
                    />
                  </div>

                  <div class="pe-field">
                    <span class="pe-flab">{t('planner.ifPlayers')}</span>
                    <div class="pe-branches">
                      {#each b.branches as br (br.id)}
                        <div class="pe-branch">
                          <span class="pe-bif">{t('planner.branchIf')}</span>
                          <input
                            class="pe-bin cond"
                            placeholder={t('planner.branchCondHint')}
                            value={br.cond}
                            oninput={(e) =>
                              planner.updateBranch(b.id, br.id, { cond: e.currentTarget.value })}
                          />
                          <span class="pe-barr">→</span>
                          <input
                            class="pe-bin to"
                            placeholder={t('planner.branchToHint')}
                            value={br.to}
                            oninput={(e) =>
                              planner.updateBranch(b.id, br.id, { to: e.currentTarget.value })}
                          />
                          <button
                            class="pe-mini danger"
                            title={t('planner.removeBranch')}
                            aria-label={t('planner.removeBranch')}
                            onclick={() => planner.removeBranch(b.id, br.id)}>×</button
                          >
                        </div>
                      {/each}
                      <button class="pe-addbranch" onclick={() => planner.addBranch(b.id)}
                        >＋ {t('planner.addBranch')}</button
                      >
                    </div>
                  </div>

                  <div class="pe-field">
                    <span class="pe-flab">{t('planner.timeBudget')}</span>
                    <div class="pe-budget">
                      <input
                        class="pe-minsin"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={b.mins ?? ''}
                        oninput={(e) =>
                          planner.updateBeat(b.id, {
                            mins: e.currentTarget.value ? Number(e.currentTarget.value) : undefined,
                          })}
                      />
                      <span class="pe-minslab">{t('planner.minsHint')}</span>
                      <div class="pe-track">
                        <div class="pe-trackfill" style:width="{Math.min(100, ((b.mins ?? 0) / 40) * 100)}%"></div>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      {:else}
        <Empty text={t('beats.none')} icon="edit" />
      {/each}

      <div class="pe-addrow">
        <input
          class="pe-addin"
          placeholder={t('planner.newBeat')}
          bind:value={newBeatTitle}
          onkeydown={(e) => e.key === 'Enter' && addBeat()}
        />
        <button class="pe-add" title={t('beats.addBeat')} aria-label={t('beats.addBeat')} onclick={addBeat}
          >{t('beats.addBeat')}</button
        >
      </div>

      <div class="pe-threads">
        <div class="pe-thead">
          <span class="pe-flab">{t('planner.threads')}</span>
          <span class="pe-tally"
            >{planner.tally.open} {t('quests.open')} / {planner.tally.resolved} {t('quests.resolved')}</span
          >
        </div>
        {#each planner.threads as thr (thr.id)}
          <div class="pe-thr">
            <button
              class="pe-tcheck"
              class:res={thr.resolved}
              title={thr.resolved ? t('quests.reopen') : t('quests.resolve')}
              aria-label={thr.resolved ? t('quests.reopen') : t('quests.resolve')}
              onclick={() => planner.toggleThread(thr.id)}>{thr.resolved ? '✓' : '○'}</button
            >
            <span class="pe-ttext" class:struck={thr.resolved}>{thr.text}</span>
            {#if thr.planted}<span class="pe-tmeta">{thr.planted}</span>{/if}
            <button
              class="pe-mini danger"
              title={t('quests.delete')}
              aria-label={t('quests.deleteQuest')}
              onclick={() => planner.removeThread(thr.id)}>×</button
            >
          </div>
        {:else}
          <div class="pe-tempty">{t('quests.none')}</div>
        {/each}
        <div class="pe-addthr">
          <input
            class="pe-addin"
            placeholder={t('quests.addThread')}
            bind:value={newThreadText}
            onkeydown={(e) => e.key === 'Enter' && addThread()}
          />
          <button class="pe-add" title={t('quests.addThread')} aria-label={t('quests.addThread')} onclick={addThread}>＋</button>
        </div>
      </div>

      <div class="pe-flowsec">
        <span class="pe-flab">{t('planner.flowMiniMap')} <span class="pe-sub">· {t('planner.tapJump')}</span></span>
        <FlowMap />
      </div>
    </div>
  {/if}
</div>

<style>
  .pe {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    color: var(--txt);
  }
  .pe-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(34, 62, 50, 0.35), rgba(15, 24, 21, 0.15));
  }
  .pe-dots {
    display: inline-flex;
    gap: 5px;
  }
  .pe-dots i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--line2);
  }
  .pe-campaign,
  .pe-session {
    background: transparent;
    border: none;
    color: var(--txt);
    font-family: var(--serif);
    font-size: 14px;
    padding: 2px 3px;
    border-radius: 4px;
    min-width: 40px;
  }
  .pe-campaign {
    color: var(--green);
    width: 11ch;
  }
  .pe-session {
    color: var(--muted);
    width: 9ch;
  }
  .pe-campaign:focus,
  .pe-session:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.25);
  }
  .pe-sep {
    color: var(--faint);
  }
  .pe-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .pe-reset {
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    width: 24px;
    height: 24px;
    border-radius: 6px;
  }
  .pe-reset:hover {
    color: var(--gold);
    border-color: rgba(214, 182, 94, 0.4);
  }
  .pe-modes {
    margin-left: auto;
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
  }
  .pe-mode {
    padding: 3px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .pe-mode.on {
    background: rgba(214, 182, 94, 0.16);
    color: var(--gold);
  }
  .pe-runhost {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 14px;
    max-width: 360px;
    margin: 0 auto;
    width: 100%;
  }
  .pe-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* flex-column children must not shrink under the scroll container, or their
     overflow:hidden boxes collapse and clip the beat content. */
  .pe-scroll > * {
    flex-shrink: 0;
  }
  .pe-railhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  .pe-rlab {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pe-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }
  .pe-toggle input {
    accent-color: var(--green-dim);
  }
  .pe-act {
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--faint);
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    margin: 10px 0 2px;
  }
  .pe-beat {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    overflow: hidden;
    transition: border-color 0.12s ease;
  }
  .pe-beat.over {
    border-color: var(--green);
    box-shadow: 0 0 0 1px var(--green-dim);
  }
  .pe-beat.done:not(.sel) {
    opacity: 0.55;
  }
  .pe-beat.sel {
    border-color: rgba(214, 182, 94, 0.5);
    background: var(--panel2);
  }
  .pe-beat.sel.cur {
    border-color: var(--gold);
    box-shadow: 0 0 22px -6px rgba(214, 182, 94, 0.5);
  }
  .pe-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
  }
  .pe-handle {
    color: var(--faint);
    cursor: grab;
    font-size: 12px;
    line-height: 1;
    user-select: none;
  }
  .pe-handle:active {
    cursor: grabbing;
  }
  .pe-check {
    border: none;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
  }
  .pe-check.on {
    color: var(--green);
  }
  .pe-livebadge {
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 7px;
    border-radius: 999px;
    color: var(--gold);
    border: 1px solid rgba(214, 182, 94, 0.45);
    white-space: nowrap;
  }
  .pe-title {
    flex: 1;
    min-width: 0;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0;
  }
  .pe-beat.done .pe-title {
    color: var(--muted);
  }
  .pe-titlein {
    flex: 1;
    min-width: 0;
    border: none;
    border-bottom: 1px solid transparent;
    background: transparent;
    color: #f0e7cf;
    font-family: var(--serif);
    font-size: 17px;
    font-weight: 600;
    padding: 2px 0;
  }
  .pe-titlein:focus {
    outline: none;
    border-bottom-color: rgba(214, 182, 94, 0.5);
  }
  .pe-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--ptype-c, var(--line2));
    color: var(--ptype-c, var(--muted));
    background: var(--ptype-bg, transparent);
    white-space: nowrap;
  }
  .pe-status {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--faint);
    white-space: nowrap;
  }
  .pe-status.done {
    color: var(--green-dim);
  }
  .pe-status.draft {
    color: var(--muted);
  }
  .pe-caret {
    border: none;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
  }
  .pe-caret:hover {
    color: var(--txt);
  }
  .pe-detail {
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 2px 12px 14px 12px;
    border-top: 1px solid var(--line);
  }
  .pe-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding-top: 10px;
  }
  .pe-select {
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
    font: inherit;
    font-size: 11px;
  }
  .pe-actin {
    flex: 1;
    min-width: 80px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
  }
  .pe-mini {
    border: 1px solid transparent;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 3px 6px;
    border-radius: 6px;
  }
  .pe-mini:hover {
    color: var(--txt);
    background: rgba(95, 150, 120, 0.12);
  }
  .pe-mini.danger:hover {
    color: #fff;
    background: #7a2a2a;
  }
  .pe-mini.set.on {
    color: var(--gold);
  }
  .pe-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pe-flab {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pe-sub {
    color: var(--faint);
    letter-spacing: 0.08em;
  }
  .pe-cast {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 9px;
    border-radius: 6px;
    border: 1px solid rgba(214, 182, 94, 0.4);
    background: rgba(214, 182, 94, 0.08);
    color: var(--gold);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .pe-cast:hover:not(:disabled) {
    background: rgba(214, 182, 94, 0.18);
  }
  .pe-cast:disabled {
    opacity: 0.4;
    cursor: default;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 11px;
    border-radius: 9px;
    color: var(--txt);
    font: inherit;
    resize: vertical;
  }
  .pe-boxed {
    border: 1px solid rgba(214, 182, 94, 0.3);
    border-left: 3px solid var(--gold);
    background: rgba(214, 182, 94, 0.05);
    font-family: var(--serif);
    font-size: 14.5px;
    font-style: italic;
    line-height: 1.6;
    color: #e7ddc4;
  }
  .pe-notes {
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    font-size: 13px;
  }
  .pe-preview {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
    padding: 0 2px;
  }
  .pe-preview :global(p) {
    margin: 0 0 4px;
  }
  .pe-preview :global(.md-npc) {
    color: #c9a6d4;
  }
  .pe-preview :global(.md-tag) {
    color: var(--green);
  }
  .pe-preview :global(.md-wiki) {
    color: var(--gold);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .pe-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pe-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
  }
  .pe-chip:hover {
    border-color: var(--green-dim);
    color: var(--green);
  }
  .pe-chip.npc {
    color: #c9a6d4;
  }
  .pe-rk {
    color: var(--faint);
    font-size: 10px;
  }
  .pe-cuein {
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    font-style: italic;
  }
  .pe-branches {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pe-branch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 7px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.15);
  }
  .pe-bif {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    white-space: nowrap;
  }
  .pe-barr {
    color: var(--green-dim);
  }
  .pe-bin {
    min-width: 0;
    padding: 4px 7px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .pe-bin.cond {
    flex: 1;
  }
  .pe-bin.to {
    flex: 1.4;
    color: var(--green);
  }
  .pe-addbranch {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--muted);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
    padding: 2px;
  }
  .pe-addbranch:hover {
    color: var(--green);
  }
  .pe-budget {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pe-minsin {
    width: 60px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .pe-minslab {
    font-size: 11px;
    color: var(--muted);
  }
  .pe-track {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  .pe-trackfill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--green-dim), var(--green));
  }
  .pe-addrow,
  .pe-addthr {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .pe-addin {
    flex: 1;
    min-width: 0;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .pe-add {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--green-dim);
    background: rgba(79, 163, 123, 0.1);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .pe-add:hover {
    background: rgba(79, 163, 123, 0.2);
  }
  .pe-threads {
    margin-top: 10px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pe-thead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .pe-tally {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .pe-thr {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .pe-tcheck {
    border: none;
    background: transparent;
    color: var(--gold);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
  }
  .pe-tcheck.res {
    color: var(--green-dim);
  }
  .pe-ttext {
    flex: 1;
    font-size: 12.5px;
  }
  .pe-ttext.struck {
    color: var(--muted);
    text-decoration: line-through;
  }
  .pe-tmeta {
    font-size: 10px;
    color: var(--faint);
    letter-spacing: 0.06em;
  }
  .pe-tempty {
    font-size: 12px;
    color: var(--muted);
    padding: 2px 0;
  }
  .pe-flowsec {
    margin-top: 12px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  /* per-type accents */
  .pe-beat.intro,
  .pe-type.intro {
    --ptype-c: #6fae86;
    --ptype-bg: rgba(111, 174, 134, 0.1);
  }
  .pe-beat.scene,
  .pe-type.scene {
    --ptype-c: #7fb0c9;
    --ptype-bg: rgba(127, 176, 201, 0.1);
  }
  .pe-beat.social,
  .pe-type.social {
    --ptype-c: #b58fc0;
    --ptype-bg: rgba(181, 143, 192, 0.12);
  }
  .pe-beat.combat,
  .pe-type.combat {
    --ptype-c: #c86a60;
    --ptype-bg: rgba(200, 106, 96, 0.12);
  }
  .pe-beat.reveal,
  .pe-type.reveal {
    --ptype-c: #6cc0a8;
    --ptype-bg: rgba(108, 192, 168, 0.12);
  }
</style>
