<script lang="ts">
  import { initiative, isBloodied, vagueStatus, CONDITIONS, type Combatant } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  let expandedId = $state<string | null>(null);
  let amounts = $state<Record<string, string>>({});
  let dragId = $state<string | null>(null);
  let overId = $state<string | null>(null);

  function initials(name: string): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?'
    );
  }

  /** HP bar hue: green when healthy, sliding to red as it drops. */
  function barColor(c: Combatant): string {
    const f = c.maxHp ? c.hp / c.maxHp : 0;
    const mix = Math.round(Math.max(0, Math.min(1, (1 - f) / 0.6)) * 100);
    return `color-mix(in oklab, var(--red) ${mix}%, var(--green))`;
  }

  function pct(c: Combatant): number {
    return Math.round((c.maxHp ? c.hp / c.maxHp : 0) * 100);
  }

  function add() {
    const c = initiative.add();
    expandedId = c.id;
  }

  function applyAmount(id: string, sign: 1 | -1) {
    const v = parseInt(amounts[id], 10);
    if (!(v > 0)) return;
    if (sign < 0) initiative.damage(id, v);
    else initiative.heal(id, v);
    amounts[id] = '';
  }

  function onDrop(targetId: string) {
    if (dragId) initiative.reorder(dragId, targetId);
    dragId = null;
    overId = null;
  }
</script>

<div class="it-head">
  <div class="it-round">
    <span class="it-lbl">{t('initiative.round')}</span>
    <span class="it-round-n">{initiative.round}</span>
  </div>
  <button class="it-next" onclick={() => initiative.nextTurn()}>{t('initiative.nextTurn')}</button>
</div>

{#if initiative.order.length === 0}
  <Empty text={t('initiative.empty')} actionLabel={t('initiative.addCombatant')} onAction={add} />
{:else}
  <div class="it-sub">
    <span>{t('initiative.reorderHint')}</span>
    <span
      >{initiative.order.length}
      {initiative.order.length === 1 ? t('initiative.combatant') : t('initiative.combatants')}</span
    >
  </div>

  <div class="it-list">
    {#each initiative.order as c (c.id)}
      {@const active = c.id === initiative.activeId}
      {@const bloodied = isBloodied(c)}
      <div
        class="it-row"
        class:active
        class:over={overId === c.id && dragId != null && dragId !== c.id}
        role="listitem"
        ondragover={(e) => {
          e.preventDefault();
          overId = c.id;
        }}
        ondrop={(e) => {
          e.preventDefault();
          onDrop(c.id);
        }}
      >
        <div class="it-lamp"></div>
        <div
          class="it-main"
          role="button"
          tabindex="0"
          aria-expanded={expandedId === c.id}
          draggable="true"
          ondragstart={() => (dragId = c.id)}
          ondragend={() => {
            dragId = null;
            overId = null;
          }}
          onclick={() => (expandedId = expandedId === c.id ? null : c.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              expandedId = expandedId === c.id ? null : c.id;
            }
          }}
        >
          <div class="it-init">{c.init}</div>
          <div class="it-av" class:foe={c.foe}><span>{initials(c.name)}</span></div>
          <div class="it-body">
            <div class="it-nmrow">
              <span class="it-nm">{c.name}</span>
              {#if c.hidden}<span class="it-hid" title={t('initiative.hiddenHp')}>◐</span>{/if}
            </div>
            {#if c.hidden}
              <span class="it-vague">“{vagueStatus(c)}” — {t('initiative.playersSee')}</span>
            {/if}
            {#if c.conditions.length}
              <div class="it-chips">
                {#each c.conditions as k (k.name)}
                  <span class="it-chip"
                    >{k.name.toLowerCase()}{k.rounds != null ? ` · ${k.rounds}` : ''}</span
                  >
                {/each}
              </div>
            {/if}
          </div>
          <div class="it-stats">
            <div class="it-hp" class:low={bloodied}>
              {#if bloodied}<span class="it-blood">●</span>{/if}{c.hp}<span class="it-max"
                >&nbsp;/ {c.maxHp}</span
              >
            </div>
            <div class="it-ac">{t('initiative.acShort')} {c.ac}</div>
          </div>
        </div>
        <div class="it-track">
          <div class="it-fill" style="width:{pct(c)}%; background:{barColor(c)}; box-shadow:0 0 6px {barColor(c)};"></div>
          <div class="it-tick"></div>
        </div>

        {#if expandedId === c.id}
          <div class="it-edit">
            <div class="it-dmgrow">
              <input
                class="it-amt"
                type="number"
                min="0"
                placeholder={t('initiative.amount')}
                bind:value={amounts[c.id]}
                onkeydown={(e) => e.key === 'Enter' && applyAmount(c.id, -1)}
              />
              <button class="it-btn dmg" onclick={() => applyAmount(c.id, -1)}
                >{t('initiative.dmg')}</button
              >
              <button class="it-btn heal" onclick={() => applyAmount(c.id, 1)}
                >{t('initiative.heal')}</button
              >
            </div>

            <div class="it-conds">
              <div class="it-lbl faint">{t('initiative.conditionsHint')}</div>
              <div class="it-cond-grid">
                {#each CONDITIONS as name (name)}
                  {@const on = c.conditions.find((k) => k.name === name)}
                  <span class="it-cond-pair">
                    <button
                      class="it-cond"
                      class:on={!!on}
                      onclick={() => initiative.toggleCondition(c.id, name)}>{name.toLowerCase()}</button
                    >
                    {#if on}
                      <button
                        class="it-dur"
                        title={t('initiative.roundsHint')}
                        onclick={() => initiative.cycleDuration(c.id, name)}
                        >{on.rounds == null ? '∞' : on.rounds}</button
                      >
                    {/if}
                  </span>
                {/each}
              </div>
            </div>

            <div class="it-fields">
              <input
                class="it-in name"
                value={c.name}
                oninput={(e) => initiative.set(c.id, { name: e.currentTarget.value })}
                aria-label={t('initiative.name')}
              />
              <span class="it-lbl faint">{t('initiative.init')}</span>
              <input
                class="it-in num init"
                type="number"
                value={c.init}
                oninput={(e) => initiative.set(c.id, { init: e.currentTarget.valueAsNumber || 0 })}
                onblur={() => initiative.sortByInit()}
                aria-label={t('initiative.init')}
              />
              <span class="it-lbl faint">{t('initiative.acShort')}</span>
              <input
                class="it-in num"
                type="number"
                value={c.ac}
                oninput={(e) => initiative.set(c.id, { ac: e.currentTarget.valueAsNumber || 0 })}
                aria-label={t('initiative.ac')}
              />
            </div>

            <div class="it-actions">
              <button class="it-tog" class:on={c.hidden} onclick={() => initiative.toggleHidden(c.id)}
                >◐ {c.hidden ? t('initiative.hpHidden') : t('initiative.hideHp')}</button
              >
              <button class="it-tog" onclick={() => initiative.toggleFoe(c.id)}
                >{c.foe ? `◆ ${t('initiative.foe')}` : `○ ${t('initiative.friend')}`}</button
              >
              <div class="it-spacer"></div>
              <button class="it-ob" onclick={() => initiative.moveUp(c.id)} aria-label={t('initiative.moveUp')}>▲</button>
              <button class="it-ob" onclick={() => initiative.moveDown(c.id)} aria-label={t('initiative.moveDown')}>▼</button>
              <button class="it-ob x" onclick={() => initiative.remove(c.id)} aria-label={t('initiative.remove')} title={t('initiative.remove')}><Icon name="close" size={11} /></button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<button class="it-add" onclick={add}><Icon name="plus" /> {t('initiative.addCombatant')}</button>

<style>
  @keyframes it-lamp {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .it-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--line2);
  }
  .it-round {
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  .it-lbl {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .it-lbl.faint {
    color: var(--faint);
  }
  .it-round-n {
    font-family: var(--serif);
    font-size: 26px;
    line-height: 1;
    color: var(--green);
    text-shadow: 0 0 12px rgba(111, 208, 160, 0.35);
    font-variant-numeric: tabular-nums;
  }
  .it-next {
    padding: 7px 13px;
    background: var(--fill-g14);
    border: 1px solid var(--green-dim);
    border-radius: var(--r2);
    color: var(--green);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 0 12px rgba(111, 208, 160, 0.28);
  }
  .it-next:hover {
    background: rgba(111, 208, 160, 0.22);
    border-color: var(--green);
  }
  .it-sub {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    font-size: 8.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .it-list {
    display: flex;
    flex-direction: column;
  }
  .it-row {
    position: relative;
    border-bottom: 1px solid var(--line1);
  }
  .it-row.active {
    background: var(--fill-g14);
    box-shadow: 0 0 16px rgba(111, 208, 160, 0.12);
  }
  .it-row.over {
    box-shadow: inset 0 2px 0 var(--green-dim);
  }
  .it-lamp {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 1;
    width: 0;
    background: var(--green);
  }
  .it-row.active .it-lamp {
    width: 3px;
    box-shadow: 0 0 10px 2px rgba(111, 208, 160, 0.35);
    animation: it-lamp 2.4s ease-in-out infinite;
  }
  .it-main {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
    padding: 6px 9px 4px 11px;
  }
  .it-init {
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1;
    width: 24px;
    flex-shrink: 0;
    text-align: center;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .it-row.active .it-init {
    color: var(--green);
    text-shadow: 0 0 8px rgba(111, 208, 160, 0.35);
  }
  .it-av {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--green-dim);
    border-radius: 50%;
    background: var(--fill-g08);
  }
  .it-av.foe {
    border-color: #77837c;
    border-radius: 2px;
    background: #161a17;
    transform: rotate(45deg) scale(0.85);
  }
  .it-av span {
    font-size: 8px;
    letter-spacing: 0.5px;
    font-weight: 600;
    color: var(--green);
  }
  .it-av.foe span {
    transform: rotate(-45deg);
    color: #9db0a6;
  }
  .it-body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .it-nmrow {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .it-nm {
    font-size: 12px;
    color: var(--txt);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .it-row.active .it-nm {
    font-weight: 600;
  }
  .it-hid {
    font-size: 10px;
    color: var(--green-dim);
    flex-shrink: 0;
  }
  .it-vague {
    font-family: var(--serif);
    font-style: italic;
    font-size: 11px;
    color: var(--green);
    opacity: 0.9;
    line-height: 1.2;
  }
  .it-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .it-chip {
    font-size: 8.5px;
    letter-spacing: 0.4px;
    color: var(--green);
    border: 1px solid var(--line2);
    border-radius: var(--r1);
    padding: 1px 4px;
    background: var(--fill-g08);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .it-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    flex-shrink: 0;
  }
  .it-hp {
    font-family: var(--serif);
    font-size: 14px;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: var(--txt);
    white-space: nowrap;
  }
  .it-hp.low {
    color: var(--red);
  }
  .it-blood {
    color: var(--red);
    font-size: 8px;
  }
  .it-max {
    color: var(--faint);
    font-size: 11px;
  }
  .it-ac {
    font-size: 7.5px;
    letter-spacing: 1px;
    color: var(--faint);
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }
  .it-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
    border-radius: 2px;
    margin: 0 9px 5px 11px;
  }
  .it-fill {
    height: 100%;
    border-radius: 2px;
    transition:
      width 0.25s ease,
      background 0.25s ease;
  }
  .it-tick {
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: var(--faint);
    opacity: 0.7;
  }

  /* expanded editor */
  .it-edit {
    padding: 8px 10px 9px;
    border-top: 1px dashed var(--line1);
    background: rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: default;
  }
  .it-dmgrow {
    display: flex;
    gap: 5px;
  }
  .it-amt {
    flex: 1;
    min-width: 42px;
    width: 0;
    background: var(--bg1);
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    color: var(--txt);
    font-family: var(--serif);
    font-size: 15px;
    padding: 3px 7px;
    outline: none;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .it-btn {
    padding: 4px 9px;
    border-radius: var(--r2);
    font-size: 9px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    font-weight: 600;
    cursor: pointer;
  }
  .it-btn.dmg {
    background: rgba(224, 141, 141, 0.1);
    border: 1px solid var(--red-dim);
    color: var(--red);
  }
  .it-btn.dmg:hover {
    background: rgba(224, 141, 141, 0.22);
  }
  .it-btn.heal {
    background: var(--fill-g08);
    border: 1px solid var(--green-dim);
    color: var(--green);
  }
  .it-btn.heal:hover {
    background: var(--fill-g14);
  }
  .it-conds {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .it-cond-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .it-cond-pair {
    display: inline-flex;
    align-items: stretch;
  }
  .it-cond {
    padding: 2px 6px;
    font-size: 8.5px;
    letter-spacing: 0.5px;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    color: var(--muted);
  }
  .it-cond.on {
    background: var(--fill-g14);
    border-color: var(--line2);
    border-radius: var(--r1) 0 0 var(--r1);
    color: var(--green);
  }
  .it-dur {
    padding: 2px 5px;
    background: var(--fill-g14);
    border: 1px solid var(--line2);
    border-left: none;
    border-radius: 0 var(--r1) var(--r1) 0;
    color: var(--green);
    font-size: 8.5px;
    font-family: var(--serif);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .it-fields {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .it-in {
    background: var(--bg1);
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    color: var(--txt);
    padding: 4px 7px;
    outline: none;
    font: inherit;
    font-size: 11px;
  }
  .it-in:focus {
    border-color: var(--line2);
  }
  .it-in.name {
    flex: 1;
    min-width: 60px;
    width: 0;
  }
  .it-in.num {
    width: 38px;
    text-align: center;
    font-family: var(--serif);
    font-size: 13px;
    padding: 3px 5px;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .it-in.init {
    color: var(--green);
  }
  .it-amt::-webkit-outer-spin-button,
  .it-amt::-webkit-inner-spin-button,
  .it-in.num::-webkit-outer-spin-button,
  .it-in.num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .it-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .it-tog {
    padding: 3px 8px;
    font-size: 8px;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: transparent;
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    color: var(--muted);
    cursor: pointer;
  }
  .it-tog.on {
    background: var(--fill-g14);
    border-color: var(--line2);
    color: var(--green);
  }
  .it-spacer {
    flex: 1;
  }
  .it-ob {
    width: 24px;
    padding: 3px 0;
    background: transparent;
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    color: var(--muted);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
  }
  .it-ob:hover {
    border-color: var(--line2);
    color: var(--green);
  }
  .it-ob.x:hover {
    border-color: var(--red-dim);
    color: var(--red);
  }
  .it-add {
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    background: transparent;
    border: none;
    border-top: 1px solid var(--line2);
    color: var(--green-dim);
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
  }
  .it-add:hover {
    color: var(--green);
    background: var(--fill-g08);
  }
</style>
