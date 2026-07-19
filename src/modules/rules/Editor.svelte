<script lang="ts">
  import { rules } from './store.svelte';
  import { RULE_CATEGORIES, type RuleCategory, type RuleEntry, type Ruling } from './data';
  import { systemConfig, type GameSystem } from '../../lib/system';
  import { toast } from '../../lib/stores/toast.svelte';
  import { t } from '../../lib/i18n';
  import { loc, setLoc } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import type { Locale } from '../../lib/stores/lang.svelte';

  type Sys = GameSystem | 'both';
  const SYS_OPTS: Sys[] = ['dnd5e', 'coc7e', 'both'];
  function sysLabel(s: Sys): string {
    return s === 'both' ? t('rules.core') : systemConfig(s).label;
  }
  function catLabel(c: RuleCategory): string {
    return t(`rules.cat.${c}`);
  }
  const csv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  let tab = $state<'ref' | 'rulings'>('ref');
  // Which language the authoring forms edit; the other language is preserved.
  let editLang = $state<Locale>(lang.current);
  const LOCALES: Locale[] = ['en', 'pl'];

  // ── Reference editing ────────────────────────────────────────────────
  let q = $state('');
  let catFilter = $state<RuleCategory | ''>('');
  let selRuleId = $state<string | null>(null);
  let showIO = $state(false);
  let ioText = $state('');

  interface RuleDraft {
    term: string;
    body: string;
    system: Sys;
    category: RuleCategory;
    aliases: string;
    tags: string;
    book: string;
    page: string;
  }
  let ruleDraft = $state<RuleDraft | null>(null);

  const refList = $derived.by(() => {
    const ql = q.trim().toLowerCase();
    return rules.allRules
      .filter((e) => (catFilter ? e.category === catFilter : true))
      .filter((e) => (ql ? loc(e.term, editLang).toLowerCase().includes(ql) : true))
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          loc(a.term, editLang).localeCompare(loc(b.term, editLang)),
      );
  });

  function pickRule(e: RuleEntry) {
    selRuleId = e.id;
    ruleDraft = {
      term: loc(e.term, editLang),
      body: loc(e.body, editLang),
      system: e.system,
      category: e.category,
      aliases: e.aliases.join(', '),
      tags: e.tags.join(', '),
      book: e.source?.book ?? '',
      page: e.source?.page ?? '',
    };
  }

  // Re-seed the open draft(s) from the stored entry when the edit language flips.
  function switchLang(l: Locale) {
    editLang = l;
    const e = selRuleId ? rules.allRules.find((x) => x.id === selRuleId) : null;
    if (e && ruleDraft) pickRule(e);
    const r = selRulingId ? rules.rulings.find((x) => x.id === selRulingId) : null;
    if (r && rulingDraft) pickRuling(r);
  }

  function newRule() {
    const e = rules.addRule({ term: t('rules.newRule') });
    pickRule(e);
  }

  function saveRule() {
    if (!selRuleId || !ruleDraft) return;
    const cur = rules.allRules.find((e) => e.id === selRuleId);
    const source = ruleDraft.book || ruleDraft.page ? { book: ruleDraft.book, page: ruleDraft.page } : undefined;
    rules.updateRule(selRuleId, {
      term: setLoc(cur?.term, editLang, ruleDraft.term),
      body: setLoc(cur?.body, editLang, ruleDraft.body),
      system: ruleDraft.system,
      category: ruleDraft.category,
      aliases: csv(ruleDraft.aliases),
      tags: csv(ruleDraft.tags),
      source,
    });
    toast.show(t('rules.save'));
  }

  function deleteRule() {
    if (!selRuleId) return;
    rules.removeRule(selRuleId);
    selRuleId = null;
    ruleDraft = null;
  }

  function exportIO() {
    ioText = rules.exportJson();
    showIO = true;
  }
  function importIO() {
    try {
      const c = rules.importJson(ioText);
      toast.show(`+${c.rules} / +${c.rulings}`);
      showIO = false;
    } catch {
      toast.show('Invalid JSON');
    }
  }

  // ── Rulings editing ──────────────────────────────────────────────────
  let rq = $state('');
  let statusFilter = $state<'all' | 'active' | 'retired'>('all');
  let selRulingId = $state<string | null>(null);

  interface RulingDraft {
    title: string;
    body: string;
    system: Sys;
    ruleId: string;
    tags: string;
  }
  let rulingDraft = $state<RulingDraft | null>(null);

  const rulingList = $derived.by(() => {
    const ql = rq.trim().toLowerCase();
    return rules.rulings
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => (ql ? loc(r.title, editLang).toLowerCase().includes(ql) : true));
  });
  const selRuling = $derived(rules.rulings.find((r) => r.id === selRulingId) ?? null);
  const rulingConflicts = $derived(
    rulingDraft?.ruleId ? rules.conflictsFor({ id: selRulingId ?? undefined, ruleId: rulingDraft.ruleId }) : [],
  );

  function pickRuling(r: Ruling) {
    selRulingId = r.id;
    rulingDraft = {
      title: loc(r.title, editLang),
      body: loc(r.body, editLang),
      system: r.system,
      ruleId: r.ruleId ?? '',
      tags: r.tags.join(', '),
    };
  }
  function newRuling() {
    const r = rules.addRuling({ title: t('rules.newRuling') });
    pickRuling(r);
  }
  function saveRuling() {
    if (!selRulingId || !rulingDraft) return;
    const cur = rules.rulings.find((r) => r.id === selRulingId);
    rules.updateRuling(selRulingId, {
      title: setLoc(cur?.title, editLang, rulingDraft.title),
      body: setLoc(cur?.body, editLang, rulingDraft.body),
      system: rulingDraft.system,
      ruleId: rulingDraft.ruleId || undefined,
      tags: csv(rulingDraft.tags),
    });
    toast.show(t('rules.save'));
  }
  function deleteRuling() {
    if (!selRulingId) return;
    rules.removeRuling(selRulingId);
    selRulingId = null;
    rulingDraft = null;
  }
  function fmtDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<div class="rle">
  <div class="rle-tabs">
    <button class="rle-tab" class:on={tab === 'ref'} onclick={() => (tab = 'ref')}
      >{t('rules.reference')}</button
    >
    <button class="rle-tab" class:on={tab === 'rulings'} onclick={() => (tab = 'rulings')}
      >{t('rules.rulings')}</button
    >
    <span class="rle-sp"></span>
    <div class="rle-langs" title="Editing language">
      {#each LOCALES as l (l)}
        <button class="rle-lang" class:on={editLang === l} onclick={() => switchLang(l)}
          >{l.toUpperCase()}</button
        >
      {/each}
    </div>
  </div>

  {#if tab === 'ref'}
    <div class="rle-cols">
      <div class="rle-left">
        <div class="rle-bar">
          <input class="rle-in" placeholder={t('rules.lookup')} bind:value={q} />
          <select class="rle-in sm" bind:value={catFilter}>
            <option value="">{t('rules.all')}</option>
            {#each RULE_CATEGORIES as c (c)}<option value={c}>{catLabel(c)}</option>{/each}
          </select>
        </div>
        <div class="rle-actions">
          <button class="rle-btn" onclick={newRule}>{t('rules.addRule')}</button>
          <button class="rle-btn" onclick={exportIO}>{t('rules.export')}</button>
        </div>
        <ul class="rle-list">
          {#each refList as e (e.id)}
            <li>
              <button class="rle-item" class:on={selRuleId === e.id} onclick={() => pickRule(e)}>
                <span class="rle-itemTerm">{loc(e.term, editLang)}</span>
                <span class="rle-itemCat">{catLabel(e.category)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <div class="rle-right">
        {#if showIO}
          <span class="rle-lbl">JSON</span>
          <textarea class="rle-in rle-io" bind:value={ioText}></textarea>
          <div class="rle-formBtns">
            <button class="rle-btn" onclick={() => (showIO = false)}>{t('rules.cancel')}</button>
            <button class="rle-btn primary" onclick={importIO}>{t('rules.import')}</button>
          </div>
        {:else if ruleDraft}
          <span class="rle-lbl">{t('rules.term')}</span>
          <input class="rle-in" bind:value={ruleDraft.term} />
          <span class="rle-lbl">{t('rules.body')}</span>
          <textarea class="rle-in rle-ta" bind:value={ruleDraft.body}></textarea>
          <div class="rle-two">
            <div>
              <span class="rle-lbl">{t('rules.category')}</span>
              <select class="rle-in" bind:value={ruleDraft.category}>
                {#each RULE_CATEGORIES as c (c)}<option value={c}>{catLabel(c)}</option>{/each}
              </select>
            </div>
            <div>
              <span class="rle-lbl">System</span>
              <select class="rle-in" bind:value={ruleDraft.system}>
                {#each SYS_OPTS as s (s)}<option value={s}>{sysLabel(s)}</option>{/each}
              </select>
            </div>
          </div>
          <span class="rle-lbl">{t('rules.aliases')}</span>
          <input class="rle-in" bind:value={ruleDraft.aliases} />
          <span class="rle-lbl">{t('rules.tags')}</span>
          <input class="rle-in" bind:value={ruleDraft.tags} />
          <div class="rle-two">
            <div>
              <span class="rle-lbl">{t('rules.sourceBook')}</span>
              <input class="rle-in" bind:value={ruleDraft.book} />
            </div>
            <div>
              <span class="rle-lbl">{t('rules.sourcePage')}</span>
              <input class="rle-in" bind:value={ruleDraft.page} />
            </div>
          </div>
          <div class="rle-formBtns">
            <button class="rle-btn danger" onclick={deleteRule}>{t('rules.delete')}</button>
            <span class="rle-sp"></span>
            <button class="rle-btn" onclick={() => selRuleId && rules.duplicateRule(selRuleId)}
              >{t('rules.duplicate')}</button
            >
            <button class="rle-btn primary" onclick={saveRule}>{t('rules.save')}</button>
          </div>
        {:else}
          <div class="rle-hint">{t('rules.reference')}</div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="rle-cols">
      <div class="rle-left">
        <div class="rle-bar">
          <input class="rle-in" placeholder={t('rules.rulings')} bind:value={rq} />
          <select class="rle-in sm" bind:value={statusFilter}>
            <option value="all">{t('rules.all')}</option>
            <option value="active">{t('rules.active')}</option>
            <option value="retired">{t('rules.retired')}</option>
          </select>
        </div>
        <div class="rle-actions">
          <button class="rle-btn" onclick={newRuling}>{t('rules.logRuling')}</button>
        </div>
        <ul class="rle-list">
          {#each rulingList as r (r.id)}
            <li>
              <button class="rle-item" class:on={selRulingId === r.id} onclick={() => pickRuling(r)}>
                <span class="rle-itemTerm" class:retired={r.status === 'retired'}
                  >⚖ {loc(r.title, editLang)}</span
                >
                <span class="rle-itemCat">{fmtDate(r.createdAt)}</span>
              </button>
            </li>
          {:else}
            <li class="rle-hint">{t('rules.noRulings')}</li>
          {/each}
        </ul>
      </div>

      <div class="rle-right">
        {#if rulingDraft && selRuling}
          <span class="rle-lbl">{t('rules.rulingTitle')}</span>
          <input class="rle-in" bind:value={rulingDraft.title} />
          <span class="rle-lbl">{t('rules.rulingBody')}</span>
          <textarea class="rle-in rle-ta" bind:value={rulingDraft.body}></textarea>
          <div class="rle-two">
            <div>
              <span class="rle-lbl">{t('rules.linkedRule')}</span>
              <select class="rle-in" bind:value={rulingDraft.ruleId}>
                <option value="">{t('rules.noLink')}</option>
                {#each rules.allRules as e (e.id)}<option value={e.id}>{loc(e.term, editLang)}</option
                  >{/each}
              </select>
            </div>
            <div>
              <span class="rle-lbl">System</span>
              <select class="rle-in" bind:value={rulingDraft.system}>
                {#each SYS_OPTS as s (s)}<option value={s}>{sysLabel(s)}</option>{/each}
              </select>
            </div>
          </div>
          <span class="rle-lbl">{t('rules.tags')}</span>
          <input class="rle-in" bind:value={rulingDraft.tags} />
          {#if rulingConflicts.length}
            <div class="rle-conflict">
              ⚠ {t('rules.conflictWarn')}
              {#each rulingConflicts as c (c.id)}<span class="rle-cf">{loc(c.title, editLang)}</span
                >{/each}
            </div>
          {/if}
          <div class="rle-meta">
            {t('rules.stampedAt')} {fmtDate(selRuling.createdAt)}{selRuling.sessionLabel
              ? ` · ${selRuling.sessionLabel}`
              : ''}
          </div>
          <div class="rle-formBtns">
            <button class="rle-btn danger" onclick={deleteRuling}>{t('rules.delete')}</button>
            <span class="rle-sp"></span>
            {#if selRuling.status === 'active'}
              <button class="rle-btn" onclick={() => rules.setRulingStatus(selRuling.id, 'retired')}
                >{t('rules.retire')}</button
              >
            {:else}
              <button class="rle-btn" onclick={() => rules.setRulingStatus(selRuling.id, 'active')}
                >{t('rules.reactivate')}</button
              >
            {/if}
            <button class="rle-btn primary" onclick={saveRuling}>{t('rules.save')}</button>
          </div>
        {:else}
          <div class="rle-hint">{t('rules.rulings')}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .rle {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 8px;
    padding: 10px;
    box-sizing: border-box;
    overflow: hidden;
  }
  .rle-tabs {
    display: flex;
    gap: 4px;
  }
  .rle-tab {
    padding: 5px 14px;
    border-radius: var(--r2);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .rle-tab.on {
    border-color: var(--green);
    color: var(--green);
  }
  .rle-langs {
    display: flex;
    gap: 2px;
  }
  .rle-lang {
    padding: 4px 9px;
    border-radius: var(--r1);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  .rle-lang.on {
    border-color: var(--green);
    color: var(--green);
  }
  .rle-cols {
    display: grid;
    grid-template-columns: minmax(180px, 34%) 1fr;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }
  .rle-left,
  .rle-right {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }
  .rle-right {
    overflow: auto;
    border-left: 1px solid var(--line1);
    padding-left: 10px;
  }
  .rle-bar {
    display: flex;
    gap: 4px;
  }
  .rle-actions {
    display: flex;
    gap: 4px;
  }
  .rle-in {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .rle-in.sm {
    width: auto;
    flex: 0 0 auto;
  }
  .rle-ta {
    min-height: 70px;
    resize: vertical;
  }
  .rle-io {
    min-height: 200px;
    font-family: var(--mono, monospace);
    font-size: 11px;
  }
  .rle-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rle-item {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 6px;
    border-radius: var(--r1);
    border: 1px solid transparent;
    background: none;
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .rle-item:hover {
    background: var(--surface2);
  }
  .rle-item.on {
    border-color: var(--green);
    background: var(--surface2);
  }
  .rle-itemTerm {
    flex: 1;
    font-size: 12.5px;
    color: var(--green);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rle-itemTerm.retired {
    color: var(--muted);
    text-decoration: line-through;
  }
  .rle-itemCat {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }
  .rle-lbl {
    display: block;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 4px;
    margin-bottom: 2px;
  }
  .rle-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .rle-formBtns {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .rle-sp {
    flex: 1;
  }
  .rle-btn {
    padding: 5px 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .rle-btn.primary {
    border-color: var(--green);
    color: var(--green);
  }
  .rle-btn.danger {
    border-color: var(--red);
    color: var(--red);
  }
  .rle-conflict {
    font-size: 11px;
    color: var(--red);
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    margin-top: 6px;
  }
  .rle-cf {
    border: 1px solid var(--red);
    border-radius: var(--r1);
    padding: 0 4px;
  }
  .rle-meta {
    font-size: 10.5px;
    color: var(--muted);
    font-style: italic;
    margin-top: 6px;
  }
  .rle-hint {
    color: var(--muted);
    font-size: 12px;
    padding: 8px 0;
  }
</style>
