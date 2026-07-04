<script lang="ts">
  import { onMount } from 'svelte';
  import { planner } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  onMount(() => void planner.load());
</script>

<div class="run">
  {#if planner.current}
    {@const beat = planner.current}
    <div class="head">
      <span class="tag {beat.type}">{t('planner.type.' + beat.type)}</span>
      <span class="pos">{planner.cursorPos} / {planner.beats.length}</span>
    </div>
    <h3 class="title">{beat.title}</h3>
    {#if beat.boxed.trim()}
      <p class="boxed">{beat.boxed}</p>
    {/if}
    {#if beat.branches.length}
      <div class="blabel">{t('planner.ifPlayers')}</div>
      <ul class="branches">
        {#each beat.branches as br (br.id)}
          {@const target = planner.branchTargetId(br.to)}
          <li>
            {#if target}
              <button class="branch jump" onclick={() => planner.jumpTo(target)} title={t('planner.jumpTo')}>
                <span class="cond">{br.cond}</span>
                <span class="arr">→</span>
                <span class="to">{br.to}</span>
              </button>
            {:else}
              <div class="branch end">
                <span class="cond">{br.cond}</span>
                <span class="arr">→</span>
                <span class="to">{br.to}</span>
                <span class="badge">{t('planner.outcome')}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <div class="nav">
      <button class="nbtn" onclick={() => planner.step(-1)} title={t('planner.prev')}
        ><Icon name="prev" size={13} /> {t('planner.prev')}</button
      >
      <button class="nbtn ghost" onclick={() => planner.step(1)} title={t('planner.next')}
        >{t('planner.next')} <Icon name="next" size={13} /></button
      >
    </div>
  {:else}
    <Empty text={t('beats.none')} icon="edit" />
  {/if}
</div>

<style>
  .run {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: auto;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .pos {
    margin-left: auto;
    font-size: 11px;
    color: var(--muted);
  }
  .title {
    margin: 0;
    font-size: 17px;
    font-weight: 500;
    color: var(--green);
  }
  .boxed {
    margin: 0;
    border-left: 3px solid var(--gold);
    background: rgba(214, 182, 94, 0.06);
    padding: 8px 10px;
    border-radius: 0 8px 8px 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.6;
    color: #e7ddc4;
  }
  .blabel {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-weight: 700;
  }
  .branches {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .branches li {
    font-size: 12px;
    color: var(--txt);
  }
  .branch {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 12px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: var(--panel2);
  }
  .branch.jump {
    cursor: pointer;
    border-color: var(--green-dim);
  }
  .branch.jump:hover {
    background: rgba(79, 163, 123, 0.15);
  }
  .branch.end {
    opacity: 0.72;
    border-style: dashed;
  }
  .cond {
    color: var(--muted);
    font-style: italic;
  }
  .arr {
    color: var(--green-dim);
  }
  .to {
    color: var(--green);
    flex: 1;
  }
  .branch.jump .to {
    text-decoration: underline;
    text-decoration-color: var(--green-dim);
    text-underline-offset: 2px;
  }
  .badge {
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    border: 1px solid var(--line2);
    border-radius: 999px;
    padding: 0 5px;
  }
  .nav {
    display: flex;
    gap: 6px;
    margin-top: auto;
    padding-top: 4px;
  }
  .nbtn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--green-dim);
    background: var(--panel2);
    color: var(--green);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .nbtn:hover {
    background: rgba(79, 163, 123, 0.15);
  }
  .nbtn.ghost {
    color: var(--muted);
    border-color: var(--line2);
    background: transparent;
  }
  .nbtn.ghost:hover {
    color: var(--green);
    background: rgba(79, 163, 123, 0.1);
  }
</style>
