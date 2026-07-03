<script lang="ts">
  import { onMount } from 'svelte';
  import { npcs, type Disposition } from './store.svelte';
  import { spellLibrary } from './spells.svelte';
  import { queryNpcs, dispositionCounts, type DispFilter } from './roster';
  import { parseNpcs, parseSpells, NPC_PROMPT, SPELL_PROMPT } from './import';
  import { assetPut, assetUrl } from '../../lib/db';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';
  import ImportPanel from '../../lib/components/ImportPanel.svelte';

  const dispositions: Disposition[] = ['ally', 'neutral', 'hostile'];
  const filters: DispFilter[] = ['all', 'ally', 'neutral', 'hostile'];
  const dot: Record<Disposition, string> = { ally: 'ally', neutral: 'neutral', hostile: 'hostile' };

  onMount(() => void spellLibrary.load());

  let query = $state('');
  let dispFilter = $state<DispFilter>('all');
  let selectedId = $state<string | null>(null);
  // Which attached spells have their edit panel expanded.
  let spellEdit = $state<Record<string, boolean>>({});
  // Toggles for the JSON-import panels.
  let showNpcImport = $state(false);
  let showSpellImport = $state(false);

  const counts = $derived(dispositionCounts(npcs.list));
  const shown = $derived(queryNpcs(npcs.list, query, dispFilter));
  const selected = $derived(npcs.list.find((n) => n.id === selectedId) ?? null);

  // Keep a valid selection: default to the first visible NPC; if the selected
  // one scrolls out of the filter or is deleted, fall back to the first shown.
  $effect(() => {
    if (selectedId && npcs.list.some((n) => n.id === selectedId)) return;
    selectedId = shown[0]?.id ?? npcs.list[0]?.id ?? null;
  });

  // Cross-module focus (e.g. from a notebook [[wikilink]]): clear filters so the
  // target is visible, select it, and scroll its list row into view.
  let listEl: HTMLElement | undefined = $state();
  $effect(() => {
    const id = npcs.focusId;
    if (!id) return;
    query = '';
    dispFilter = 'all';
    selectedId = id;
    npcs.focusId = null;
    queueMicrotask(() => {
      listEl?.querySelector(`[data-npc="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  });

  // Resolve every referenced asset id (primary + gallery) -> object URL,
  // revoking old ones on change.
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    for (const n of npcs.list) {
      if (n.portraitId) want.add(n.portraitId);
      for (const g of n.gallery ?? []) want.add(g);
    }
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
    for (const url of Object.values(urls)) URL.revokeObjectURL(url);
  });

  async function pickPortrait(npcId: string, file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.setPrimaryPhoto(npcId, assetId);
  }
  async function addToGallery(npcId: string, file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.addPhoto(npcId, assetId);
  }

  function createNpc() {
    selectedId = npcs.add().id;
  }

  // Create a brand-new library spell, attach it to this NPC, and open its editor.
  function newSpell(npcId: string) {
    const spell = spellLibrary.add('');
    npcs.attachSpell(npcId, spell.id);
    spellEdit[spell.id] = true;
  }
  function attachSpell(npcId: string, spellId: string) {
    if (spellId) npcs.attachSpell(npcId, spellId);
  }

  // --- JSON import handlers (passed to <ImportPanel>) -----------------------
  function importNpcJson(raw: string): { ok: boolean; message: string } {
    const { items, error } = parseNpcs(raw);
    if (error) {
      return { ok: false, message: t(error === 'invalid-json' ? 'jsonImport.invalidJson' : 'jsonImport.noNpcs') };
    }
    const created = npcs.importNpcs(items);
    if (created[0]) {
      query = '';
      dispFilter = 'all';
      selectedId = created[0].id;
    }
    showNpcImport = false;
    return { ok: true, message: `${t('jsonImport.importedNpcs')} ${created.length}` };
  }

  function importSpellJson(npcId: string, raw: string): { ok: boolean; message: string } {
    const { items, error } = parseSpells(raw);
    if (error) {
      return { ok: false, message: t(error === 'invalid-json' ? 'jsonImport.invalidJson' : 'jsonImport.noSpells') };
    }
    const created = spellLibrary.importMany(items);
    for (const s of created) npcs.attachSpell(npcId, s.id);
    showSpellImport = false;
    return { ok: true, message: `${t('jsonImport.importedSpells')} ${created.length}` };
  }
</script>

<div class="editor">
  <!-- master: searchable, filterable roster -->
  <aside class="master">
    <header class="mhead">
      <h2>{t('npcs.roster')}</h2>
      <div class="hbtns">
        <button
          class="btn"
          class:on={showNpcImport}
          onclick={() => (showNpcImport = !showNpcImport)}
          title={t('npcs.importHint')}><Icon name="export" /> {t('npcs.import')}</button
        >
        <button class="btn solid" onclick={createNpc}><Icon name="plus" /> {t('npcs.newNpc')}</button>
      </div>
    </header>

    {#if showNpcImport}
      <ImportPanel promptText={NPC_PROMPT} placeholder={t('npcs.importPlaceholder')} onImport={importNpcJson} />
    {/if}

    <div class="searchrow">
      <Icon name="search" class="si" />
      <input class="in search" bind:value={query} placeholder={t('npcs.searchEditor')} />
    </div>

    <div class="chips">
      {#each filters as f (f)}
        <button class="chip" class:on={dispFilter === f} onclick={() => (dispFilter = f)}>
          {f === 'all' ? t('npcs.filterAll') : t('npcs.disposition.' + f)}
          <span class="ct">{counts[f]}</span>
        </button>
      {/each}
    </div>

    <div class="list" bind:this={listEl}>
      {#each shown as n (n.id)}
        <button
          class="row"
          class:sel={n.id === selectedId}
          data-npc={n.id}
          onclick={() => (selectedId = n.id)}
        >
          <span class="rport">
            {#if n.portraitId && urls[n.portraitId]}
              <img src={urls[n.portraitId]} alt="" />
            {:else}
              <span class="rini">{n.name.slice(0, 2).toUpperCase() || '??'}</span>
            {/if}
          </span>
          <span class="rmeta">
            <span class="rname">{n.name || t('npcs.namePlaceholder')}</span>
            <span class="rrole">{n.role || t('npcs.disposition.' + n.disposition)}</span>
          </span>
          <span class="rdot {dot[n.disposition]}"></span>
        </button>
      {:else}
        {#if npcs.list.length === 0}
          <Empty text={t('npcs.empty')} actionLabel={t('npcs.newNpc')} onAction={createNpc} />
        {:else}
          <p class="muted none">{t('npcs.noneMatchPre')}{query}{t('npcs.noneMatchPost')}</p>
        {/if}
      {/each}
    </div>
  </aside>

  <!-- detail: full editor for the selected NPC -->
  <section class="detail">
    {#if selected}
      {@const n = selected}
      <div class="portrow">
        <label class="port" title={t('npcs.uploadPortrait')}>
          {#if n.portraitId && urls[n.portraitId]}
            <img class="pimg" src={urls[n.portraitId]} alt="{n.name} portrait" />
          {:else}
            <span class="pinit">{n.name.slice(0, 2).toUpperCase() || '??'}</span>
          {/if}
          <input
            type="file"
            accept="image/*"
            hidden
            onchange={(e) => void pickPortrait(n.id, e.currentTarget.files?.[0])}
          />
        </label>
        <div class="pfields">
          <input
            class="in name"
            value={n.name}
            oninput={(e) => npcs.update(n.id, { name: e.currentTarget.value })}
            placeholder={t('npcs.namePlaceholder')}
          />
          <input
            class="in"
            value={n.role}
            oninput={(e) => npcs.update(n.id, { role: e.currentTarget.value })}
            placeholder={t('npcs.rolePlaceholder')}
          />
          <div class="rowflex">
            <select
              class="in"
              value={n.disposition}
              onchange={(e) => npcs.update(n.id, { disposition: e.currentTarget.value as Disposition })}
            >
              {#each dispositions as d (d)}<option value={d}>{t('npcs.disposition.' + d)}</option>{/each}
            </select>
            <button class="btn danger" onclick={() => npcs.remove(n.id)}>
              <Icon name="trash" /> {t('npcs.delete')}
            </button>
          </div>
        </div>
      </div>

      <input
        class="in"
        value={n.voice ?? ''}
        oninput={(e) => npcs.update(n.id, { voice: e.currentTarget.value })}
        placeholder={t('npcs.voicePlaceholder')}
      />

      <!-- Gallery -->
      <section class="sec">
        <div class="seclabel">{t('npcs.gallery')}</div>
        <div class="thumbs">
          {#each n.gallery ?? [] as gid (gid)}
            <div class="thumb" class:primary={gid === n.portraitId}>
              {#if urls[gid]}
                <button
                  type="button"
                  class="thumbpick"
                  title={t('npcs.setPrimary')}
                  onclick={() => npcs.setPrimaryPhoto(n.id, gid)}
                >
                  <img src={urls[gid]} alt="" />
                </button>
              {/if}
              <button
                type="button"
                class="thumbx"
                aria-label={t('npcs.removePhoto')}
                onclick={() => npcs.removePhoto(n.id, gid)}>×</button
              >
            </div>
          {/each}
          <label class="thumb addthumb" title={t('npcs.addPhoto')}>
            ＋
            <input
              type="file"
              accept="image/*"
              hidden
              onchange={(e) => void addToGallery(n.id, e.currentTarget.files?.[0])}
            />
          </label>
        </div>
      </section>

      <!-- Characteristics -->
      <section class="sec">
        <div class="seclabel">
          {t('npcs.stats')}
          <button class="mini" onclick={() => npcs.addStat(n.id)}>{t('npcs.addRow')}</button>
        </div>
        {#each n.stats ?? [] as s (s.id)}
          <div class="statrow">
            <input
              class="in"
              value={s.key}
              oninput={(e) => npcs.updateStat(n.id, s.id, { key: e.currentTarget.value })}
              placeholder={t('npcs.statKeyPlaceholder')}
            />
            <input
              class="in"
              value={s.val}
              oninput={(e) => npcs.updateStat(n.id, s.id, { val: e.currentTarget.value })}
              placeholder={t('npcs.statValPlaceholder')}
            />
            <button class="mini" aria-label={t('npcs.removeStat')} onclick={() => npcs.removeStat(n.id, s.id)}>×</button>
          </div>
        {/each}
      </section>

      <!-- Attacks -->
      <section class="sec">
        <div class="seclabel">
          {t('npcs.attacks')}
          <button class="mini" onclick={() => npcs.addAttack(n.id)}>{t('npcs.addRow')}</button>
        </div>
        {#each n.attacks ?? [] as a (a.id)}
          <div class="attackrow">
            <input
              class="in"
              value={a.name}
              oninput={(e) => npcs.updateAttack(n.id, a.id, { name: e.currentTarget.value })}
              placeholder={t('npcs.attackNamePlaceholder')}
            />
            <input
              class="in"
              value={a.chance ?? ''}
              oninput={(e) => npcs.updateAttack(n.id, a.id, { chance: e.currentTarget.value })}
              placeholder={t('npcs.attackChancePlaceholder')}
            />
            <input
              class="in"
              value={a.damage ?? ''}
              oninput={(e) => npcs.updateAttack(n.id, a.id, { damage: e.currentTarget.value })}
              placeholder={t('npcs.attackDamagePlaceholder')}
            />
            <button class="mini" aria-label={t('npcs.removeAttack')} onclick={() => npcs.removeAttack(n.id, a.id)}>×</button>
          </div>
        {/each}
      </section>

      <!-- Skills -->
      <section class="sec">
        <div class="seclabel">
          {t('npcs.skills')}
          <button class="mini" onclick={() => npcs.addSkill(n.id)}>{t('npcs.addRow')}</button>
        </div>
        {#each n.skills ?? [] as sk (sk.id)}
          <div class="statrow">
            <input
              class="in"
              value={sk.name}
              oninput={(e) => npcs.updateSkill(n.id, sk.id, { name: e.currentTarget.value })}
              placeholder={t('npcs.skillNamePlaceholder')}
            />
            <input
              class="in"
              value={sk.value ?? ''}
              oninput={(e) => npcs.updateSkill(n.id, sk.id, { value: e.currentTarget.value })}
              placeholder={t('npcs.skillValPlaceholder')}
            />
            <button class="mini" aria-label={t('npcs.removeSkill')} onclick={() => npcs.removeSkill(n.id, sk.id)}>×</button>
          </div>
        {/each}
      </section>

      <!-- Armor + Sanity loss -->
      <section class="sec">
        <div class="seclabel">{t('npcs.defence')}</div>
        <div class="rowflex">
          <input
            class="in"
            value={n.armor ?? ''}
            oninput={(e) => npcs.update(n.id, { armor: e.currentTarget.value })}
            placeholder={t('npcs.armorPlaceholder')}
          />
          <input
            class="in"
            value={n.sanityLoss ?? ''}
            oninput={(e) => npcs.update(n.id, { sanityLoss: e.currentTarget.value })}
            placeholder={t('npcs.sanityLossPlaceholder')}
          />
        </div>
      </section>

      <!-- Inventory -->
      <section class="sec">
        <div class="seclabel">
          {t('npcs.equipment')}
          <button class="mini" onclick={() => npcs.addEquip(n.id)}>{t('npcs.addRow')}</button>
        </div>
        {#each n.equipment ?? [] as it (it.id)}
          <div class="equiprow">
            <input
              class="in"
              value={it.name}
              oninput={(e) => npcs.updateEquip(n.id, it.id, { name: e.currentTarget.value })}
              placeholder={t('npcs.itemPlaceholder')}
            />
            <input
              class="in qty"
              type="number"
              value={it.qty ?? ''}
              oninput={(e) =>
                npcs.updateEquip(n.id, it.id, {
                  qty: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value),
                })}
              placeholder={t('npcs.qtyPlaceholder')}
            />
            <input
              class="in"
              value={it.notes ?? ''}
              oninput={(e) => npcs.updateEquip(n.id, it.id, { notes: e.currentTarget.value })}
              placeholder={t('npcs.notesPlaceholder')}
            />
            <button class="mini" aria-label={t('npcs.removeItem')} onclick={() => npcs.removeEquip(n.id, it.id)}>×</button>
          </div>
        {/each}
      </section>

      <!-- Spells (references into the shared library) -->
      <section class="sec">
        <div class="seclabel">
          {t('npcs.spells')}
          <button class="mini" onclick={() => (showSpellImport = !showSpellImport)}>{t('npcs.import')}</button>
          <button class="mini" onclick={() => newSpell(n.id)}>{t('npcs.newSpell')}</button>
        </div>
        {#if showSpellImport}
          <ImportPanel
            promptText={SPELL_PROMPT}
            placeholder={t('npcs.spellImportPlaceholder')}
            onImport={(raw) => importSpellJson(n.id, raw)}
          />
        {/if}
        {#each (n.spellIds ?? []).map((id) => spellLibrary.get(id)).filter((s) => s !== undefined) as sp (sp.id)}
          <div class="spellrow">
            <button
              class="spellname"
              aria-expanded={!!spellEdit[sp.id]}
              onclick={() => (spellEdit[sp.id] = !spellEdit[sp.id])}
            >
              <Icon name="chevron" size={12} class={spellEdit[sp.id] ? 'chev open' : 'chev'} />
              {sp.name || t('npcs.spellNamePlaceholder')}
            </button>
            <span class="spellmeta">{[sp.cost, sp.castingTime].filter(Boolean).join(' · ')}</span>
            <button
              class="mini"
              aria-label={t('npcs.detachSpell')}
              title={t('npcs.detachSpell')}
              onclick={() => npcs.detachSpell(n.id, sp.id)}>×</button
            >
          </div>
          {#if spellEdit[sp.id]}
            <div class="spelledit">
              <input
                class="in"
                value={sp.name}
                oninput={(e) => spellLibrary.update(sp.id, { name: e.currentTarget.value })}
                placeholder={t('npcs.spellNamePlaceholder')}
              />
              <div class="rowflex">
                <input
                  class="in"
                  value={sp.cost ?? ''}
                  oninput={(e) => spellLibrary.update(sp.id, { cost: e.currentTarget.value })}
                  placeholder={t('npcs.spellCostPlaceholder')}
                />
                <input
                  class="in"
                  value={sp.castingTime ?? ''}
                  oninput={(e) => spellLibrary.update(sp.id, { castingTime: e.currentTarget.value })}
                  placeholder={t('npcs.spellTimePlaceholder')}
                />
              </div>
              <input
                class="in"
                value={sp.altNames ?? ''}
                oninput={(e) => spellLibrary.update(sp.id, { altNames: e.currentTarget.value })}
                placeholder={t('npcs.spellAltPlaceholder')}
              />
              <textarea
                class="in ta"
                value={sp.description ?? ''}
                oninput={(e) => spellLibrary.update(sp.id, { description: e.currentTarget.value })}
                placeholder={t('npcs.spellDescPlaceholder')}
              ></textarea>
              <div class="muted small">{t('npcs.spellShared')}</div>
            </div>
          {/if}
        {/each}

        {#if spellLibrary.list.some((s) => !(n.spellIds ?? []).includes(s.id))}
          <select
            class="in"
            value=""
            onchange={(e) => {
              attachSpell(n.id, e.currentTarget.value);
              e.currentTarget.value = '';
            }}
          >
            <option value="">{t('npcs.addFromLibrary')}</option>
            {#each spellLibrary.list.filter((s) => !(n.spellIds ?? []).includes(s.id)) as s (s.id)}
              <option value={s.id}>{s.name || t('npcs.spellNamePlaceholder')}</option>
            {/each}
          </select>
        {/if}
      </section>

      <!-- Public blurb -->
      <section class="sec">
        <div class="seclabel public">{t('npcs.publicBlurb')}</div>
        <textarea
          class="in ta"
          value={n.publicBlurb ?? ''}
          oninput={(e) => npcs.update(n.id, { publicBlurb: e.currentTarget.value })}
          placeholder={t('npcs.publicBlurbPlaceholder')}
        ></textarea>
      </section>

      <!-- GM notes -->
      <section class="sec">
        <div class="seclabel private">{t('npcs.gmNotes')}</div>
        <textarea
          class="in ta"
          value={n.gmNotes ?? ''}
          oninput={(e) => npcs.update(n.id, { gmNotes: e.currentTarget.value })}
          placeholder={t('npcs.gmNotesPlaceholder')}
        ></textarea>
      </section>
    {:else}
      <div class="nosel">{t('npcs.selectHint')}</div>
    {/if}
  </section>
</div>

<style>
  .editor {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  /* --- master ------------------------------------------------------------- */
  .master {
    flex: 0 0 264px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 14px;
    border-right: 1px solid var(--line);
    overflow: hidden;
  }
  .mhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mhead h2 {
    font-family: Georgia, serif;
    font-size: 18px;
    color: #e9f3ed;
  }
  .hbtns {
    display: flex;
    gap: 6px;
  }
  .searchrow {
    position: relative;
    display: flex;
    align-items: center;
  }
  .searchrow :global(.si) {
    position: absolute;
    left: 9px;
    color: var(--muted);
    pointer-events: none;
  }
  .search {
    padding-left: 30px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--line2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    text-transform: capitalize;
  }
  .chip.on {
    background: rgba(47, 138, 102, 0.18);
    border-color: var(--green-dim);
    color: var(--txt);
  }
  .chip .ct {
    font-size: 10px;
    color: var(--faint);
    font-variant-numeric: tabular-nums;
  }
  .chip.on .ct {
    color: var(--green);
  }
  .list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0 -4px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 8px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .row:hover {
    background: var(--panel2, rgba(20, 28, 22, 0.5));
  }
  .row.sel {
    background: rgba(47, 138, 102, 0.16);
    border-color: var(--green-dim);
  }
  .rport {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
  }
  .rport img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .rini {
    font: 600 11px Georgia, serif;
    color: var(--green);
  }
  .rmeta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .rname {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rrole {
    font-size: 11px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rdot {
    flex: 0 0 auto;
    margin-left: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
  }
  .rdot.ally {
    background: #4fbf8b;
  }
  .rdot.hostile {
    background: #d3624f;
  }
  .rdot.neutral {
    background: var(--gold, #c7a44e);
  }
  .none {
    padding: 12px 4px;
    font-size: 12px;
  }

  /* --- detail ------------------------------------------------------------- */
  .detail {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .nosel {
    margin: auto;
    color: var(--faint);
    font-size: 13px;
  }
  .portrow {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .port {
    flex: 0 0 auto;
    width: 88px;
    height: 88px;
    border-radius: 12px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
    overflow: hidden;
    cursor: pointer;
  }
  .pimg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .pinit {
    font: 600 24px Georgia, serif;
    color: var(--green);
    letter-spacing: 1px;
  }
  .pfields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .in {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .in.name {
    font-weight: 600;
    font-size: 16px;
  }
  .rowflex {
    display: flex;
    gap: 8px;
  }
  .rowflex .in {
    flex: 1;
  }

  .sec {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .seclabel {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .seclabel.public {
    color: var(--green);
  }
  .seclabel.private {
    color: #d98c7a;
  }
  .mini {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .mini:hover {
    background: rgba(47, 138, 102, 0.18);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .btn:hover {
    background: rgba(47, 138, 102, 0.16);
  }
  .btn.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .btn.on {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.18);
    color: var(--green);
  }
  .btn.danger {
    flex: 0 0 auto;
  }
  .btn.danger:hover {
    background: rgba(180, 76, 60, 0.2);
    border-color: rgba(180, 76, 60, 0.6);
    color: #e6907f;
  }

  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .thumb {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--line2);
  }
  .thumb.primary {
    border-color: var(--green);
    box-shadow: 0 0 0 1px var(--green);
  }
  .thumbpick {
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .thumbpick img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumbx {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 0;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
  }
  .addthumb {
    display: grid;
    place-items: center;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.25);
    color: var(--green);
    font-size: 20px;
  }

  .equiprow,
  .statrow,
  .attackrow {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .in.qty {
    width: 64px;
    flex: 0 0 auto;
  }
  .ta {
    min-height: 64px;
    resize: vertical;
    line-height: 1.4;
  }

  /* spells */
  .spellrow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .spellname {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    min-width: 0;
    padding: 4px 2px;
    border: 0;
    background: transparent;
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .spellname:hover {
    color: var(--green);
  }
  .spellname :global(.chev) {
    transition: transform 0.12s;
  }
  .spellname :global(.chev.open) {
    transform: rotate(180deg);
  }
  .spellmeta {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 11px;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .spelledit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 2px 0 8px 14px;
    padding-left: 10px;
    border-left: 2px solid var(--line2);
  }
</style>
