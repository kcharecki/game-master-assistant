<script lang="ts">
  import { lore } from './store.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';

  const sel = $derived(lore.selected);
  const links = $derived(sel ? lore.linksOf(sel.id) : []);
  const backs = $derived(sel ? lore.backlinksOf(sel.id) : []);

  function openOrCreate(title: string, targetId: string | undefined) {
    if (targetId) lore.select(targetId);
    else lore.select(lore.add(title).id);
  }
</script>

<div class="editor">
  <aside class="side">
    <header class="shead">
      <h2>{t('lore.title')}</h2>
      <button class="btn solid sm" aria-label={t('lore.addPage')} title={t('lore.addPage')} onclick={() => lore.add()}><Icon name="plus" /></button>
    </header>
    {#if lore.pages.length === 0}
      <Empty text={t('lore.empty')} actionLabel={t('lore.addPage')} onAction={() => lore.add()} />
    {/if}
    <ul class="plist">
      {#each lore.pages as p (p.id)}
        <li>
          <button class="pbtn" class:on={p.id === lore.selectedId} onclick={() => lore.select(p.id)}>
            {p.title || t('lore.untitled')}
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <section class="main">
    {#if sel}
      <input
        class="in title"
        value={sel.title}
        oninput={(e) => lore.update(sel.id, { title: e.currentTarget.value })}
        placeholder={t('lore.titlePlaceholder')}
      />
      <textarea
        class="in body"
        value={sel.body}
        oninput={(e) => lore.update(sel.id, { body: e.currentTarget.value })}
        placeholder={t('lore.bodyPlaceholder')}
      ></textarea>

      <div class="meta">
        <div class="metacol">
          <h4>{t('lore.linksOut')}</h4>
          {#if links.length}
            {#each links as l (l.title)}
              <button
                class="chip"
                class:dangling={!l.targetId}
                onclick={() => openOrCreate(l.title, l.targetId)}
              >
                {l.title}{#if !l.targetId}<span class="plus"> ＋</span>{/if}
              </button>
            {/each}
          {:else}
            <span class="muted">{t('lore.none')}</span>
          {/if}
        </div>
        <div class="metacol">
          <h4>{t('lore.backlinksHead')}</h4>
          {#if backs.length}
            {#each backs as b (b.id)}
              <button class="chip" onclick={() => lore.select(b.id)}>{b.title}</button>
            {/each}
          {:else}
            <span class="muted">{t('lore.none')}</span>
          {/if}
        </div>
      </div>

      <button class="btn del" onclick={() => lore.remove(sel.id)}>{t('lore.deletePage')}</button>
    {:else}
      <p class="muted">{t('lore.noPageSelected')}</p>
    {/if}
  </section>
</div>

<style>
  .editor {
    display: grid;
    grid-template-columns: 200px 1fr;
    height: 100%;
    overflow: hidden;
  }
  .side {
    border-right: 1px solid var(--line1);
    padding: 16px 12px;
    overflow: auto;
  }
  .shead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .shead h2 {
    font-family: var(--serif), Georgia, serif;
    font-size: 20px;
    color: var(--txt);
  }
  .plist {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pbtn {
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt);
    font: inherit;
    cursor: pointer;
  }
  .pbtn:hover {
    background: var(--fill-g08);
  }
  .pbtn.on {
    border-color: var(--line2);
    background: var(--surface2);
  }
  .main {
    padding: 18px 22px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .in {
    padding: 8px 10px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
  }
  .title {
    font-family: var(--serif), Georgia, serif;
    font-size: 18px;
    font-weight: 600;
  }
  .body {
    min-height: 200px;
    resize: vertical;
    line-height: 1.5;
  }
  .meta {
    display: flex;
    gap: 26px;
    flex-wrap: wrap;
  }
  .metacol h4 {
    color: var(--muted);
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .chip {
    display: inline-block;
    margin: 0 6px 6px 0;
    padding: 4px 9px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line2);
    background: var(--surface2);
    color: var(--green);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .chip.dangling {
    color: var(--muted);
    border-style: dashed;
  }
  .plus {
    color: var(--gold);
  }
  .del {
    align-self: flex-start;
    color: var(--red);
    margin-top: 8px;
  }
</style>
