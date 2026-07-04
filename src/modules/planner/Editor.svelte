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

  onMount(() => void planner.load());

  let newBeatTitle = $state('');
  let newThreadText = $state('');

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
</script>

<div class="pl">
  <div class="bar">
    <div class="run">
      <button
        class="rbtn"
        title={t('planner.prev')}
        aria-label={t('planner.prev')}
        onclick={() => planner.step(-1)}><Icon name="prev" size={13} /></button
      >
      <button
        class="rbtn"
        title={t('planner.next')}
        aria-label={t('planner.next')}
        onclick={() => planner.step(1)}><Icon name="next" size={13} /></button
      >
      <span class="runlab"
        >{t('planner.runCursor')}:
        <b>{planner.current?.title ?? '—'}</b>
        {#if planner.beats.length}<span class="pos">{planner.cursorPos} / {planner.beats.length}</span>{/if}
      </span>
    </div>
    <span class="tally"
      >{planner.tally.open} {t('quests.open')} · {planner.tally.resolved} {t('quests.resolved')}</span
    >
  </div>

  <div class="body">
    <div class="rail">
      <span class="rlab">{t('beats.sceneFlow')}</span>
      {#each planner.beats as b (b.id)}
        <div
          class="beat"
          class:sel={b.id === planner.selectedId}
          class:cur={b.id === planner.currentId}
        >
          <button class="beatmain" onclick={() => planner.select(b.id)}>
            <span class="bt">{b.title}</span>
            <span class="brow">
              <span class="tag {b.type}">{t('planner.type.' + b.type)}</span>
              <span class="st {b.status}">{t('planner.status.' + b.status)}</span>
            </span>
          </button>
          <div class="beatacts">
            <button
              class="mini"
              title={t('beats.moveUp')}
              aria-label={t('beats.moveUp')}
              onclick={() => planner.move(b.id, -1)}>▲</button
            >
            <button
              class="mini"
              title={t('beats.moveDown')}
              aria-label={t('beats.moveDown')}
              onclick={() => planner.move(b.id, 1)}>▼</button
            >
          </div>
        </div>
      {:else}
        <Empty text={t('beats.none')} icon="edit" />
      {/each}
      <div class="addrow">
        <input
          class="in"
          placeholder={t('planner.newBeat')}
          bind:value={newBeatTitle}
          onkeydown={(e) => e.key === 'Enter' && addBeat()}
        />
        <button class="rbtn" title={t('beats.addBeat')} aria-label={t('beats.addBeat')} onclick={addBeat}
          >＋</button
        >
      </div>
    </div>

    <div class="detail">
      {#if planner.selected}
        {@const beat = planner.selected}
        <div class="dh">
          <input
            class="titlein"
            value={beat.title}
            oninput={(e) => planner.updateBeat(beat.id, { title: e.currentTarget.value })}
          />
          <select
            class="sel"
            value={beat.type}
            onchange={(e) => planner.updateBeat(beat.id, { type: e.currentTarget.value as BeatType })}
          >
            {#each BEAT_TYPES as ty (ty)}<option value={ty}>{t('planner.type.' + ty)}</option>{/each}
          </select>
          <select
            class="sel"
            value={beat.status}
            onchange={(e) =>
              planner.updateBeat(beat.id, { status: e.currentTarget.value as BeatStatus })}
          >
            {#each BEAT_STATUSES as s (s)}<option value={s}>{t('planner.status.' + s)}</option>{/each}
          </select>
          <button
            class="mini set"
            class:on={beat.id === planner.currentId}
            title={t('planner.markCurrent')}
            aria-label={t('planner.markCurrent')}
            onclick={() => planner.setCurrent(beat.id)}>◉</button
          >
          <button
            class="mini danger"
            title={t('beats.removeBeat')}
            aria-label={t('beats.removeBeat')}
            onclick={() => planner.removeBeat(beat.id)}><Icon name="trash" size={13} /></button
          >
        </div>

        <div class="field">
          <span class="flab">
            <Icon name="edit" size={12} /> {t('planner.readAloud')}
            <button
              class="pushbtn"
              disabled={!beat.boxed.trim()}
              title={t('planner.pushStage')}
              onclick={pushToStage}><Icon name="air" size={12} /> {t('planner.pushStage')}</button
            >
          </span>
          <textarea
            class="boxed"
            rows="3"
            placeholder={t('planner.readAloudHint')}
            value={beat.boxed}
            oninput={(e) => planner.updateBeat(beat.id, { boxed: e.currentTarget.value })}
          ></textarea>
        </div>

        <div class="field">
          <span class="flab">{t('planner.gmNotes')}</span>
          <textarea
            class="notes"
            rows="3"
            placeholder={t('planner.gmNotesHint')}
            value={beat.body}
            oninput={(e) => planner.updateBeat(beat.id, { body: e.currentTarget.value })}
          ></textarea>
          {#if bodyHtml}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input; only our own tags are re-added -->
            <div class="preview" onclick={onBodyClick}>{@html bodyHtml}</div>
          {/if}
        </div>

        {#if refs.length}
          <div class="field">
            <span class="flab">{t('planner.references')}</span>
            <div class="refs">
              {#each refs as r (r.kind + r.name)}
                <button class="rchip" class:npc={r.kind === 'npc'} onclick={() => jump(r.name)}>
                  <span class="rk">{r.kind === 'npc' ? '@' : '[[]]'}</span>
                  {r.name}
                  <Icon name="open" size={11} />
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="field">
          <span class="flab">{t('planner.ifPlayers')}</span>
          <div class="branches">
            {#each beat.branches as br (br.id)}
              <div class="branch">
                <span class="bif">{t('planner.branchIf')}</span>
                <input
                  class="bin cond"
                  placeholder={t('planner.branchCondHint')}
                  value={br.cond}
                  oninput={(e) => planner.updateBranch(beat.id, br.id, { cond: e.currentTarget.value })}
                />
                <span class="barr">→</span>
                <input
                  class="bin to"
                  placeholder={t('planner.branchToHint')}
                  value={br.to}
                  oninput={(e) => planner.updateBranch(beat.id, br.id, { to: e.currentTarget.value })}
                />
                <button
                  class="mini danger"
                  title={t('planner.removeBranch')}
                  aria-label={t('planner.removeBranch')}
                  onclick={() => planner.removeBranch(beat.id, br.id)}>×</button
                >
              </div>
            {/each}
            <button class="addbranch" onclick={() => planner.addBranch(beat.id)}
              >＋ {t('planner.addBranch')}</button
            >
          </div>
        </div>
      {:else}
        <Empty text={t('beats.none')} icon="edit" />
      {/if}
    </div>
  </div>

  <div class="threads">
    <div class="thead">
      <span class="flab">{t('planner.threads')}</span>
      <div class="addthr">
        <input
          class="in"
          placeholder={t('quests.addThread')}
          bind:value={newThreadText}
          onkeydown={(e) => e.key === 'Enter' && addThread()}
        />
        <button class="rbtn" title={t('quests.addThread')} aria-label={t('quests.addThread')} onclick={addThread}>＋</button>
      </div>
    </div>
    {#each planner.threads as thr (thr.id)}
      <div class="thr">
        <button
          class="tcheck"
          class:res={thr.resolved}
          title={thr.resolved ? t('quests.reopen') : t('quests.resolve')}
          aria-label={thr.resolved ? t('quests.reopen') : t('quests.resolve')}
          onclick={() => planner.toggleThread(thr.id)}>{thr.resolved ? '✓' : '○'}</button
        >
        <span class="ttext" class:struck={thr.resolved}>{thr.text}</span>
        {#if thr.planted}<span class="tmeta">{thr.planted}</span>{/if}
        <button
          class="mini danger"
          title={t('quests.delete')}
          aria-label={t('quests.deleteQuest')}
          onclick={() => planner.removeThread(thr.id)}>×</button
        >
      </div>
    {:else}
      <div class="tempty">{t('quests.none')}</div>
    {/each}
  </div>
</div>

<style>
  .pl {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    color: var(--txt);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.2);
    flex-wrap: wrap;
  }
  .run {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .runlab {
    font-size: 12px;
    color: var(--muted);
  }
  .runlab b {
    color: var(--green);
    font-weight: 500;
  }
  .pos {
    margin-left: 6px;
    color: var(--muted);
    font-size: 11px;
  }
  .tally {
    margin-left: auto;
    font-size: 11px;
    color: var(--muted);
  }
  .body {
    display: grid;
    grid-template-columns: 210px 1fr;
    flex: 1;
    min-height: 0;
  }
  .rail {
    border-right: 1px solid var(--line);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    background: rgba(0, 0, 0, 0.12);
  }
  .rlab {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 4px;
  }
  .beat {
    position: relative;
    display: flex;
    align-items: stretch;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    overflow: hidden;
  }
  .beat.sel {
    border-color: var(--green);
    background: var(--panel2);
  }
  .beat.cur::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
  }
  .beatmain {
    flex: 1;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--txt);
    padding: 7px 8px 7px 11px;
    cursor: pointer;
    font: inherit;
    min-width: 0;
  }
  .bt {
    display: block;
    font-size: 12.5px;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .beat.sel .bt {
    color: var(--green);
  }
  .brow {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .tag {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    color: var(--muted);
  }
  .tag.intro,
  .tag.reveal {
    color: var(--gold);
    border-color: rgba(214, 182, 94, 0.4);
  }
  .tag.combat {
    color: var(--red);
    border-color: var(--red-dim);
  }
  .tag.social {
    color: var(--green);
    border-color: var(--green-dim);
  }
  .st {
    font-size: 9.5px;
    color: var(--muted);
  }
  .st.done {
    color: var(--green-dim);
  }
  .beatacts {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-left: 1px solid var(--line);
  }
  .mini {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    padding: 2px 5px;
  }
  .mini:hover {
    color: var(--green);
  }
  .mini.danger:hover {
    color: var(--red);
  }
  .mini.set.on {
    color: var(--green);
  }
  .addrow,
  .addthr {
    display: flex;
    gap: 4px;
  }
  .in {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .rbtn {
    padding: 4px 9px;
    border-radius: 7px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    line-height: 1;
  }
  .rbtn:hover {
    background: rgba(79, 163, 123, 0.15);
  }
  .detail {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
    min-width: 0;
  }
  .dh {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .titlein {
    flex: 1;
    min-width: 120px;
    font-size: 16px;
    color: var(--txt);
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    font-family: inherit;
    padding: 2px 0;
  }
  .titlein:focus {
    outline: none;
    border-bottom-color: var(--green-dim);
  }
  .sel {
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
    font: inherit;
    font-size: 11px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .flab {
    font-size: 10.5px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .pushbtn {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--gold);
    background: rgba(214, 182, 94, 0.08);
    color: var(--gold);
    font: inherit;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .pushbtn:hover:not(:disabled) {
    background: rgba(214, 182, 94, 0.18);
  }
  .pushbtn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--txt);
    font: inherit;
    resize: vertical;
  }
  .boxed {
    border: 1px solid rgba(214, 182, 94, 0.35);
    border-left: 3px solid var(--gold);
    background: rgba(214, 182, 94, 0.06);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13.5px;
    line-height: 1.6;
    color: #e7ddc4;
  }
  .notes {
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    font-size: 13px;
  }
  .preview {
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--muted);
    padding: 0 2px;
  }
  .preview :global(p) {
    margin: 0 0 4px;
  }
  .preview :global(.md-tag) {
    color: var(--green);
  }
  .preview :global(.md-wiki) {
    color: var(--green);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rchip {
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
  .rchip:hover {
    border-color: var(--green-dim);
    color: var(--green);
  }
  .rchip.npc {
    color: var(--green);
  }
  .rk {
    color: var(--muted);
    font-size: 10px;
  }
  .branches {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .branch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 7px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.15);
  }
  .bif {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    white-space: nowrap;
  }
  .barr {
    color: var(--green-dim);
  }
  .bin {
    min-width: 0;
    padding: 4px 7px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .bin.cond {
    flex: 1;
  }
  .bin.to {
    flex: 1.4;
    color: var(--green);
  }
  .addbranch {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--muted);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
    padding: 2px;
  }
  .addbranch:hover {
    color: var(--green);
  }
  .threads {
    border-top: 1px solid var(--line);
    padding: 8px 12px 10px;
    background: rgba(0, 0, 0, 0.18);
    max-height: 150px;
    overflow: auto;
  }
  .thead {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .thead .addthr {
    margin-left: auto;
    width: 220px;
  }
  .thr {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .tcheck {
    border: none;
    background: transparent;
    color: var(--gold);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
  }
  .tcheck.res {
    color: var(--green-dim);
  }
  .ttext {
    font-size: 12px;
  }
  .ttext.struck {
    color: var(--muted);
    text-decoration: line-through;
  }
  .tmeta {
    margin-left: auto;
    font-size: 10px;
    color: var(--muted);
  }
  .thr .mini {
    margin-left: 4px;
  }
  .tempty {
    font-size: 12px;
    color: var(--muted);
    padding: 2px 0;
  }
</style>
