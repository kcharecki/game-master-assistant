<script lang="ts">
  import { rules } from './store.svelte';
  import { RULE_CATEGORIES, type RuleCategory } from './data';
  import { system } from '../../lib/stores/system.svelte';
  import { systemConfig } from '../../lib/system';
  import { forSystem } from './logic';
  import { t } from '../../lib/i18n';
  import { loc } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';

  let searchEl = $state<HTMLInputElement | null>(null);
  let sel = $state(0);
  let logging = $state(false);
  let draftTitle = $state('');
  let draftBody = $state('');
  let draftRuleId = $state('');

  // Categories that actually have entries in the current system (+ "All").
  const cats = $derived.by(() => {
    const present = new Set(forSystem(rules.allRules, system.current).map((e) => e.category));
    return RULE_CATEGORIES.filter((c) => present.has(c));
  });

  const results = $derived(rules.results);
  // Rulings surfaced only when searching, matched by the unified engine.
  const matchingRulings = $derived(
    rules.query.trim()
      ? rules.hits.flatMap((h) => (h.type === 'ruling' ? [h.ruling] : []))
      : [],
  );
  const conflicts = $derived(draftRuleId ? rules.conflictsFor({ ruleId: draftRuleId }) : []);

  $effect(() => {
    // keep selection in range as results change
    if (sel >= results.length) sel = Math.max(0, results.length - 1);
  });

  function catLabel(c: RuleCategory): string {
    return t(`rules.cat.${c}`);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === '/' && document.activeElement !== searchEl) {
      e.preventDefault();
      searchEl?.focus();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(results.length - 1, sel + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(0, sel - 1);
    } else if (e.key === 'a' && e.target !== searchEl) {
      rules.airRule(results[sel]);
    } else if (e.key === 'p' && e.target !== searchEl) {
      rules.togglePin(results[sel].id);
    }
  }

  function startLog() {
    draftTitle = rules.query.trim();
    draftBody = '';
    draftRuleId = results[sel]?.id ?? '';
    logging = true;
  }

  function saveLog() {
    if (!draftTitle.trim()) return;
    rules.addRuling({
      title: draftTitle.trim(),
      body: draftBody.trim(),
      ruleId: draftRuleId || undefined,
    });
    logging = false;
    draftTitle = '';
    draftBody = '';
    draftRuleId = '';
  }
</script>

<div class="rl-wrap" role="listbox" tabindex="0" aria-label="Rules" onkeydown={onKey}>
  <div class="rl-top">
    <input
      bind:this={searchEl}
      class="rl-in"
      placeholder={t('rules.lookup')}
      bind:value={rules.query}
    />
    <span class="rl-sys">{systemConfig(system.current).label}</span>
  </div>

  <div class="rl-chips">
    <button
      class="rl-chip"
      class:on={rules.categoryFilter === null}
      onclick={() => (rules.categoryFilter = null)}>{t('rules.all')}</button
    >
    {#each cats as c (c)}
      <button
        class="rl-chip"
        class:on={rules.categoryFilter === c}
        onclick={() => (rules.categoryFilter = rules.categoryFilter === c ? null : c)}
        >{catLabel(c)}</button
      >
    {/each}
  </div>

  <ul class="rl-list">
    {#each results as r, i (r.id)}
      {@const rl = rules.rulingsForRule(r.id)}
      <li class="rl-row" class:sel={i === sel}>
        <div class="rl-head">
          <span class="rl-term">{loc(r.term, lang.current)}</span>
          {#if r.system === 'both'}<span class="rl-badge">{t('rules.core')}</span>{/if}
          {#if !r.builtin}<span class="rl-badge alt">{t('rules.custom')}</span>{/if}
          <span class="rl-sp"></span>
          <button
            class="rl-ico"
            class:pinned={r.pinned}
            title={r.pinned ? t('rules.unpin') : t('rules.pin')}
            onclick={() => rules.togglePin(r.id)}>★</button
          >
          <button class="rl-ico" title={t('rules.air')} onclick={() => rules.airRule(r)}>◎</button>
        </div>
        <p class="rl-body">{loc(r.body, lang.current)}</p>
        {#if r.source?.book}
          <div class="rl-src">{r.source.book}{r.source.page ? ` p.${r.source.page}` : ''}</div>
        {/if}
        {#each rl as one (one.id)}
          {@const rt = loc(one.title, lang.current)}
          {@const rb = loc(one.body, lang.current)}
          <div class="rl-ruling">⚖ {rt}{rb ? ` — ${rb}` : ''}</div>
        {/each}
      </li>
    {:else}
      <li class="rl-empty">{t('rules.noMatch')}</li>
    {/each}

    {#if matchingRulings.length}
      <li class="rl-secLabel">{t('rules.rulings')}</li>
      {#each matchingRulings as one (one.id)}
        {@const rb = loc(one.body, lang.current)}
        <li class="rl-row rl-rulingRow">
          <div class="rl-head">
            <span class="rl-term">⚖ {loc(one.title, lang.current)}</span>
            <span class="rl-sp"></span>
            <button class="rl-ico" title={t('rules.air')} onclick={() => rules.airRuling(one)}>◎</button>
          </div>
          {#if rb}<p class="rl-body">{rb}</p>{/if}
        </li>
      {/each}
    {/if}
  </ul>

  {#if logging}
    <div class="rl-log">
      <input class="rl-in" placeholder={t('rules.rulingTitle')} bind:value={draftTitle} />
      <textarea class="rl-in rl-ta" placeholder={t('rules.rulingBody')} bind:value={draftBody}
      ></textarea>
      <select class="rl-in" bind:value={draftRuleId}>
        <option value="">{t('rules.noLink')}</option>
        {#each results as r (r.id)}
          <option value={r.id}>{loc(r.term, lang.current)}</option>
        {/each}
      </select>
      {#if conflicts.length}
        <div class="rl-conflict">
          ⚠ {t('rules.conflictWarn')}
          {#each conflicts as c (c.id)}<span class="rl-cf">{loc(c.title, lang.current)}</span>{/each}
        </div>
      {/if}
      <div class="rl-logBtns">
        <button class="rl-btn" onclick={() => (logging = false)}>{t('rules.cancel')}</button>
        <button class="rl-btn primary" onclick={saveLog}>{t('rules.save')}</button>
      </div>
    </div>
  {:else}
    <button class="rl-add" onclick={startLog}>{t('rules.logRuling')}</button>
  {/if}
</div>

<style>
  .rl-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    overflow: hidden;
    outline: none;
  }
  .rl-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rl-in {
    flex: 1;
    padding: 6px 8px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
  }
  .rl-ta {
    min-height: 44px;
    resize: vertical;
  }
  .rl-sys {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
  }
  .rl-chips {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .rl-chip {
    flex: 0 0 auto;
    padding: 2px 8px;
    border-radius: var(--r4);
    border: 1px solid var(--line1);
    background: var(--surface2);
    color: var(--muted);
    font-size: 11px;
    cursor: pointer;
  }
  .rl-chip.on {
    border-color: var(--green);
    color: var(--green);
  }
  .rl-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    flex: 1;
  }
  .rl-row {
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    padding: 6px 8px;
    background: var(--surface2);
  }
  .rl-row.sel {
    border-color: var(--green);
  }
  .rl-rulingRow {
    background: var(--surface1);
  }
  .rl-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rl-term {
    font-size: 13px;
    font-weight: 600;
    color: var(--green);
  }
  .rl-sp {
    flex: 1;
  }
  .rl-badge {
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.12em;
    font-weight: 600;
    text-transform: uppercase;
    border: 1px solid var(--line2);
    border-radius: var(--r1);
    padding: 1px 5px;
  }
  .rl-badge.alt {
    color: var(--green);
    border-color: var(--line2);
  }
  .rl-ico {
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
  }
  .rl-ico:hover {
    color: var(--txt);
  }
  .rl-ico.pinned {
    color: var(--green);
  }
  .rl-body {
    margin: 3px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--txt);
  }
  .rl-src {
    margin-top: 3px;
    font-size: 10.5px;
    color: var(--muted);
    font-style: italic;
  }
  .rl-ruling {
    margin-top: 4px;
    padding-left: 6px;
    border-left: 2px solid var(--line2);
    font-size: 11.5px;
    color: var(--muted);
  }
  .rl-secLabel {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    padding-top: 2px;
  }
  .rl-empty {
    color: var(--muted);
    font-size: 12px;
    list-style: none;
  }
  .rl-add {
    padding: 5px 8px;
    border-radius: var(--r2);
    border: 1px dashed var(--line2);
    background: none;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .rl-add:hover {
    color: var(--green);
    border-color: var(--green);
  }
  .rl-log {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid var(--line1);
    padding-top: 6px;
  }
  .rl-conflict {
    font-size: 11px;
    color: var(--red);
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .rl-cf {
    border: 1px solid var(--red);
    border-radius: var(--r1);
    padding: 0 4px;
  }
  .rl-logBtns {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .rl-btn {
    padding: 4px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .rl-btn.primary {
    border-color: var(--green);
    color: var(--green);
  }
</style>
