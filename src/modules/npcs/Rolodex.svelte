<script lang="ts">
  import { onMount } from 'svelte';
  import { npcs, type Disposition, type Npc } from './store.svelte';
  import { spellLibrary, type Spell } from './spells.svelte';
  import { filterNpcs } from './roster';
  import { parseNpcs, parseSpells, NPC_PROMPT, SPELL_PROMPT } from './import';
  import { publicView } from './public';
  import { assetUrl } from '../../lib/db';
  import { loc, setLoc, locStrings, paragraphs, type LocalizedText } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import Empty from '../../lib/components/Empty.svelte';
  import ImportPanel from '../../lib/components/ImportPanel.svelte';
  import NpcForm from './NpcForm.svelte';
  import { putOnAir } from '../reveal/bus-actions';

  const g = (v: LocalizedText | undefined) => loc(v, lang.current);
  const ps = (v: LocalizedText | undefined) => paragraphs(v, lang.current);
  const sl = (v: LocalizedText | undefined, text: string) => setLoc(v, lang.current, text);
  const dispClass: Record<Disposition, string> = { ally: 'ally', neutral: 'neutral', hostile: 'hostile' };

  onMount(() => void spellLibrary.load());

  type Deck = 'npcs' | 'spells';
  let deck = $state<Deck>('npcs');
  let query = $state('');
  let selectedNpcId = $state<string | null>(null);
  let selectedSpellId = $state<string | null>(null);
  let editing = $state(false); // flip the selected card into its edit form
  let showImport = $state(false);

  // Reset transient view state when switching decks.
  function switchDeck(next: Deck) {
    if (deck === next) return;
    deck = next;
    editing = false;
    showImport = false;
    query = '';
  }

  const shownNpcs = $derived(filterNpcs(npcs.list, query));
  const shownSpells = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spellLibrary.list;
    return spellLibrary.list.filter((s) =>
      [...locStrings(s.name), ...locStrings(s.altNames)].some((f) => f.toLowerCase().includes(q)),
    );
  });
  const selectedNpc = $derived(npcs.list.find((n) => n.id === selectedNpcId) ?? null);
  const selectedSpell = $derived(spellLibrary.list.find((s) => s.id === selectedSpellId) ?? null);

  // Keep a valid selection in each deck: default to the first visible card, and
  // fall back if the selected one is filtered out or deleted.
  $effect(() => {
    if (selectedNpcId && npcs.list.some((n) => n.id === selectedNpcId)) return;
    selectedNpcId = shownNpcs[0]?.id ?? npcs.list[0]?.id ?? null;
  });
  $effect(() => {
    if (selectedSpellId && spellLibrary.list.some((s) => s.id === selectedSpellId)) return;
    selectedSpellId = shownSpells[0]?.id ?? spellLibrary.list[0]?.id ?? null;
  });

  // Cross-module focus (e.g. notebook [[wikilink]]) → jump to that NPC.
  $effect(() => {
    const id = npcs.focusId;
    if (!id) return;
    deck = 'npcs';
    query = '';
    editing = false;
    selectedNpcId = id;
    npcs.focusId = null;
  });

  // Resolve portrait asset ids for every NPC (card + tab strip) → object URLs.
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set(npcs.list.map((n) => n.portraitId).filter(Boolean) as string[]);
    // Also resolve the selected NPC's full gallery for the paper-clipped photo stack.
    for (const id of selectedNpc?.gallery ?? []) want.add(id);
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

  const initials = (v: LocalizedText | undefined) => g(v).slice(0, 2).toUpperCase() || '??';

  // Photos for the paper-clipped stack: primary first, then the rest of the gallery.
  const photos = $derived.by(() => {
    const n = selectedNpc;
    if (!n) return [] as string[];
    const rest = (n.gallery ?? []).filter((id) => id !== n.portraitId);
    return [...(n.portraitId ? [n.portraitId] : []), ...rest];
  });

  function selectNpc(id: string) {
    selectedNpcId = id;
    editing = false;
  }
  function removeNpc(n: Npc) {
    if (confirm(`${t('npcs.deleteConfirm')}\n\n${g(n.name)}`)) npcs.remove(n.id);
  }
  function selectSpell(id: string) {
    selectedSpellId = id;
    editing = false;
  }

  function createNpc() {
    selectedNpcId = npcs.add().id;
    deck = 'npcs';
    query = '';
    editing = true;
  }
  function createSpell() {
    selectedSpellId = spellLibrary.add('').id;
    deck = 'spells';
    query = '';
    editing = true;
  }

  // Reveal the player-safe projection on the broadcast: portrait as an image if
  // present, otherwise the public blurb as a text card. GM-only fields never cross.
  function reveal(npc: Npc) {
    const pv = publicView(npc, lang.current);
    if (pv.portraitId) {
      putOnAir({ kind: 'image', assetId: pv.portraitId, caption: pv.name });
    } else if (pv.blurb) {
      putOnAir({ kind: 'text', title: pv.name, body: pv.blurb });
    }
  }

  // --- header JSON import (deck-aware) --------------------------------------
  function importNpcJson(raw: string): { ok: boolean; message: string } {
    const { items, error } = parseNpcs(raw);
    if (error) {
      return { ok: false, message: t(error === 'invalid-json' ? 'jsonImport.invalidJson' : 'jsonImport.noNpcs') };
    }
    const created = npcs.importNpcs(items);
    if (created[0]) {
      query = '';
      selectedNpcId = created[0].id;
      editing = false;
    }
    showImport = false;
    return { ok: true, message: `${t('jsonImport.importedNpcs')} ${created.length}` };
  }
  function importSpellJson(raw: string): { ok: boolean; message: string } {
    const { items, error } = parseSpells(raw);
    if (error) {
      return { ok: false, message: t(error === 'invalid-json' ? 'jsonImport.invalidJson' : 'jsonImport.noSpells') };
    }
    const created = spellLibrary.importMany(items);
    if (created[0]) {
      query = '';
      selectedSpellId = created[0].id;
      editing = false;
    }
    showImport = false;
    return { ok: true, message: `${t('jsonImport.importedSpells')} ${created.length}` };
  }

  const spellMeta = (sp: Spell) => [g(sp.cost), g(sp.castingTime)].filter(Boolean).join(' · ');
  const npcsKnowing = (spellId: string) => npcs.list.filter((n) => (n.spellIds ?? []).includes(spellId));

  // Flip to the previous/next card in the current deck (wraps around).
  const canNav = $derived(
    !editing && (deck === 'npcs' ? shownNpcs.length > 1 : shownSpells.length > 1),
  );
  function step(dir: 1 | -1) {
    if (deck === 'npcs') {
      const list = shownNpcs;
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((x) => x.id === selectedNpcId));
      selectNpc(list[(i + dir + list.length) % list.length].id);
    } else {
      const list = shownSpells;
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((x) => x.id === selectedSpellId));
      selectSpell(list[(i + dir + list.length) % list.length].id);
    }
  }
  // The rolodex tab label: first letter/number of the name (for "filed under X").
  const filedLetter = (v: LocalizedText | undefined) => {
    const m = g(v).trim().match(/[\p{L}\p{N}]/u);
    return (m ? m[0] : '?').toUpperCase();
  };

</script>

<div class="rolodex">
  <!-- ===== header ===== -->
  <header class="rhead">
    <div class="seg" role="tablist" aria-label={t('npcs.roster')}>
      <button class="segb" class:on={deck === 'npcs'} role="tab" aria-selected={deck === 'npcs'} onclick={() => switchDeck('npcs')}>{t('npcs.deckNpcs')}</button>
      <button class="segb" class:on={deck === 'spells'} role="tab" aria-selected={deck === 'spells'} onclick={() => switchDeck('spells')}>{t('npcs.deckSpells')}</button>
    </div>

    <div class="searchrow">
      <Icon name="search" class="si" />
      <input
        class="in search"
        bind:value={query}
        placeholder={deck === 'npcs' ? t('npcs.searchEditor') : t('npcs.searchSpells')}
      />
    </div>

    <div class="spacer"></div>

    <button class="btn" class:on={showImport} onclick={() => (showImport = !showImport)} title={t('npcs.importHint')}>
      <Icon name="export" /> {t('npcs.import')}
    </button>
    {#if deck === 'npcs'}
      <button class="btn solid" onclick={createNpc}><Icon name="plus" /> {t('npcs.newNpc')}</button>
    {:else}
      <button class="btn solid" onclick={createSpell}><Icon name="plus" /> {t('npcs.newSpellPlain')}</button>
    {/if}
  </header>

  {#if showImport}
    <div class="importwrap">
      {#if deck === 'npcs'}
        <ImportPanel promptText={NPC_PROMPT} placeholder={t('npcs.importPlaceholder')} onImport={importNpcJson} />
      {:else}
        <ImportPanel promptText={SPELL_PROMPT} placeholder={t('npcs.spellImportPlaceholder')} onImport={importSpellJson} />
      {/if}
    </div>
  {/if}

  <!-- ===== stage: the front card ===== -->
  {#snippet peekDeck()}
    <div class="spindle" aria-hidden="true"></div>
    <div class="peek peek1" aria-hidden="true"></div>
    <div class="peek peek2" aria-hidden="true"></div>
    <div class="peek peek3" aria-hidden="true"></div>
  {/snippet}
  {#snippet holes()}
    <span class="hole l" aria-hidden="true"></span>
    <span class="hole r" aria-hidden="true"></span>
  {/snippet}
  <div class="stage">
    {#if deck === 'npcs'}
      {#if selectedNpc}
        {@const n = selectedNpc}
        {@const idx = shownNpcs.findIndex((x) => x.id === n.id)}
        <div class="deckwrap">
          <button class="navbtn prev" aria-label={t('npcs.prevCard')} disabled={!canNav} onclick={() => step(-1)}>‹</button>
          <div class="deck">
            {#if !editing}{@render peekDeck()}<span class="clip" aria-hidden="true"></span>{/if}
            <article class="card" class:editmode={editing}>
              {#if !editing}{@render holes()}{/if}
          {#if editing}
            <div class="card-scroll">
              <NpcForm npc={n} />
            </div>
            <div class="card-foot">
              <span class="idx">{idx >= 0 ? idx + 1 : 1} / {shownNpcs.length} · {t('npcs.filedUnder')} “{filedLetter(n.name)}”</span>
              <div class="foot-btns">
                <button class="cbtn dark" onclick={() => (editing = false)}>{t('npcs.done')}</button>
              </div>
            </div>
          {:else}
            <div class="card-scroll">
              <span class="stamp" aria-hidden="true">
                {t('npcs.stampTitle')}<small>{t('npcs.stampSub')}</small>
              </span>
              <div class="card-top">
                <div class="photostack" class:multi={photos.length > 1}>
                  {#if photos.length}
                    {#each photos as pid, i (pid)}
                      <button
                        class="snap"
                        class:primary={i === 0}
                        style="--i:{i}"
                        disabled={i === 0}
                        title={i === 0 ? '' : t('npcs.setPrimary')}
                        aria-label={t('npcs.setPrimary')}
                        onclick={() => npcs.setPrimaryPhoto(n.id, pid)}
                      >
                        {#if urls[pid]}<img src={urls[pid]} alt="" />{:else}<span class="pini">{initials(n.name)}</span>{/if}
                      </button>
                    {/each}
                  {:else}
                    <span class="snap primary empty"><span class="pini">{initials(n.name)}</span></span>
                  {/if}
                </div>
                <div class="card-id">
                  <div class="fileline">
                    <span>{t('npcs.dossierFileNo')} <b>{filedLetter(n.name)}-{String(idx >= 0 ? idx + 1 : 1).padStart(3, '0')}</b></span>
                    <span class="regsec">§ XIII</span>
                  </div>
                  <div class="subjlabel">{t('npcs.dossierSubject')}</div>
                  <div class="nm">{g(n.name) || t('npcs.namePlaceholder')}</div>
                  {#if g(n.role)}<div class="role">{g(n.role)}</div>{/if}
                  <span class="tag {dispClass[n.disposition]}">{t('npcs.disposition.' + n.disposition)}</span>
                </div>
              </div>

              <div class="body2">
                <!-- left column: the mechanical stat block -->
                <div class="bcol">
                  {#if (n.stats ?? []).some((s) => g(s.key) || g(s.val))}
                    <div class="fld">
                      <div class="k">{t('npcs.stats')}</div>
                      <div class="statgrid">
                        {#each n.stats ?? [] as s (s.id)}
                          {#if g(s.key) || g(s.val)}
                            <div class="sb"><span class="l">{g(s.key)}</span><span class="nnum">{g(s.val)}</span></div>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if (n.skills ?? []).some((s) => g(s.name) || g(s.value))}
                    <div class="fld">
                      <div class="k">{t('npcs.skills')}</div>
                      <div class="skillrow">
                        {#each n.skills ?? [] as s (s.id)}
                          {#if g(s.name) || g(s.value)}
                            <span class="sk"><b>{g(s.name)}</b> {g(s.value)}</span>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if g(n.armor) || g(n.sanityLoss)}
                    <div class="chiprow">
                      {#if g(n.armor)}<span class="dchip">{t('npcs.armorShort')} · {g(n.armor)}</span>{/if}
                      {#if g(n.sanityLoss)}<span class="dchip san">{t('npcs.sanLossShort')} · {g(n.sanityLoss)}</span>{/if}
                    </div>
                  {/if}
                  {#if (n.attacks ?? []).some((a) => g(a.name) || g(a.chance) || g(a.damage))}
                    <div class="fld">
                      <div class="k">{t('npcs.attacks')}</div>
                      <ul class="lines">
                        {#each n.attacks ?? [] as a (a.id)}
                          {#if g(a.name) || g(a.chance) || g(a.damage)}
                            <li><b>{g(a.name)}</b> {[g(a.chance), g(a.damage)].filter(Boolean).join(' · ')}</li>
                          {/if}
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if (n.equipment ?? []).some((e) => g(e.name))}
                    <div class="fld">
                      <div class="k">{t('npcs.equipment')}</div>
                      <ul class="lines">
                        {#each n.equipment ?? [] as it (it.id)}
                          {#if g(it.name)}<li>{g(it.name)}{#if it.qty}<span class="qty"> ×{it.qty}</span>{/if}{#if g(it.notes)} — {g(it.notes)}{/if}</li>{/if}
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if (n.spellIds ?? []).length}
                    <div class="fld">
                      <div class="k">{t('npcs.spells')}</div>
                      <div class="skillrow">
                        {#each (n.spellIds ?? []).map((id) => spellLibrary.get(id)).filter((s) => s !== undefined) as sp (sp.id)}
                          <button class="spellchip" onclick={() => { switchDeck('spells'); selectSpell(sp.id); }}>{g(sp.name) || t('npcs.spellNamePlaceholder')}</button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- right column: the narrative / read-aloud material -->
                <div class="bcol">
                  {#if g(n.voice)}
                    <div class="fld"><div class="k">{t('npcs.voicePlaceholder')}</div><div class="v quote">{g(n.voice)}</div></div>
                  {/if}
                  {#if g(n.publicBlurb)}
                    <div class="fld"><div class="k public">{t('npcs.publicBlurb')}</div><div class="v prose">{#each ps(n.publicBlurb) as para}<p>{para}</p>{/each}</div></div>
                  {/if}
                  {#if g(n.gmNotes)}
                    <div class="secret">
                      <div class="k"><span>👁</span> {t('npcs.gmNotes')}</div>
                      <div class="v prose">{#each ps(n.gmNotes) as para}<p>{para}</p>{/each}</div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            <div class="card-foot">
              <span class="idx">{idx >= 0 ? idx + 1 : 1} / {shownNpcs.length} · {t('npcs.filedUnder')} “{filedLetter(n.name)}”</span>
              <div class="foot-btns">
                <button class="cbtn danger" onclick={() => removeNpc(n)}><Icon name="trash" /> {t('npcs.delete')}</button>
                <button class="cbtn" onclick={() => (editing = true)}>✎ {t('npcs.edit')}</button>
                <button class="cbtn dark" onclick={() => reveal(n)}>{t('npcs.reveal')}</button>
              </div>
            </div>
          {/if}
            </article>
          </div>
          <button class="navbtn next" aria-label={t('npcs.nextCard')} disabled={!canNav} onclick={() => step(1)}>›</button>
        </div>
      {:else}
        <Empty text={t('npcs.deckEmptyNpcs')} actionLabel={t('npcs.newNpc')} onAction={createNpc} />
      {/if}
    {:else if selectedSpell}
      {@const sp = selectedSpell}
      {@const idx = shownSpells.findIndex((x) => x.id === sp.id)}
      {@const known = npcsKnowing(sp.id)}
      <div class="deckwrap">
        <button class="navbtn prev" aria-label={t('npcs.prevCard')} disabled={!canNav} onclick={() => step(-1)}>‹</button>
        <div class="deck">
          {#if !editing}{@render peekDeck()}{/if}
          <article class="card" class:editmode={editing}>
            {#if !editing}{@render holes()}{/if}
        {#if editing}
          <div class="card-scroll spellform">
            <input class="in" value={g(sp.name)} oninput={(e) => spellLibrary.update(sp.id, { name: sl(sp.name, e.currentTarget.value) })} placeholder={t('npcs.spellNamePlaceholder')} />
            <div class="rowflex">
              <input class="in" value={g(sp.cost)} oninput={(e) => spellLibrary.update(sp.id, { cost: sl(sp.cost, e.currentTarget.value) })} placeholder={t('npcs.spellCostPlaceholder')} />
              <input class="in" value={g(sp.castingTime)} oninput={(e) => spellLibrary.update(sp.id, { castingTime: sl(sp.castingTime, e.currentTarget.value) })} placeholder={t('npcs.spellTimePlaceholder')} />
            </div>
            <input class="in" value={g(sp.altNames)} oninput={(e) => spellLibrary.update(sp.id, { altNames: sl(sp.altNames, e.currentTarget.value) })} placeholder={t('npcs.spellAltPlaceholder')} />
            <textarea class="in ta" value={g(sp.description)} oninput={(e) => spellLibrary.update(sp.id, { description: sl(sp.description, e.currentTarget.value) })} placeholder={t('npcs.spellDescPlaceholder')}></textarea>
            <div class="rowflex end">
              <button class="cbtn danger" onclick={() => { spellLibrary.remove(sp.id); editing = false; }}><Icon name="trash" /> {t('npcs.delete')}</button>
            </div>
          </div>
          <div class="card-foot">
            <span class="idx">{idx >= 0 ? idx + 1 : 1} / {shownSpells.length} · {t('npcs.filedUnder')} “{filedLetter(sp.name)}”</span>
            <div class="foot-btns"><button class="cbtn dark" onclick={() => (editing = false)}>{t('npcs.done')}</button></div>
          </div>
        {:else}
          <div class="card-scroll">
            <div class="sp-top">
              <span class="glyph">✦</span>
              <div class="card-id">
                <div class="nm">{g(sp.name) || t('npcs.spellNamePlaceholder')}</div>
                {#if g(sp.altNames)}<div class="role">{g(sp.altNames)}</div>{/if}
                {#if spellMeta(sp)}<div class="metarow"><span class="mtag">{spellMeta(sp)}</span></div>{/if}
              </div>
            </div>
            {#if g(sp.description)}
              <div class="desc">{#each ps(sp.description) as para}<p>{para}</p>{/each}</div>
            {/if}
            {#if known.length}
              <div class="fld">
                <div class="k">{t('npcs.knownBy')}</div>
                <div class="skillrow">
                  {#each known as kn (kn.id)}
                    <button class="npcchip" onclick={() => { switchDeck('npcs'); selectNpc(kn.id); }}>
                      <span class="rd {dispClass[kn.disposition]}"></span>{g(kn.name) || t('npcs.namePlaceholder')}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          <div class="card-foot">
            <span class="idx">{idx >= 0 ? idx + 1 : 1} / {shownSpells.length} · {t('npcs.filedUnder')} “{filedLetter(sp.name)}”</span>
            <div class="foot-btns"><button class="cbtn" onclick={() => (editing = true)}>✎ {t('npcs.edit')}</button></div>
          </div>
        {/if}
          </article>
        </div>
        <button class="navbtn next" aria-label={t('npcs.nextCard')} disabled={!canNav} onclick={() => step(1)}>›</button>
      </div>
    {:else}
      <Empty text={t('npcs.deckEmptySpells')} actionLabel={t('npcs.newSpellPlain')} onAction={createSpell} />
    {/if}
  </div>

  <!-- ===== tab strip (flip through the deck) ===== -->
  <div class="tabstrip">
    {#if deck === 'npcs'}
      {#each shownNpcs as n (n.id)}
        <button class="rtab" class:active={n.id === selectedNpcId} onclick={() => selectNpc(n.id)}>
          <span class="tav">
            {#if n.portraitId && urls[n.portraitId]}<img src={urls[n.portraitId]} alt="" />{:else}{initials(n.name)}{/if}
          </span>
          <span class="tmeta">
            <span class="tn">{g(n.name) || t('npcs.namePlaceholder')}</span>
            <span class="tr">{g(n.role) || t('npcs.disposition.' + n.disposition)}</span>
          </span>
          <span class="tdot {dispClass[n.disposition]}"></span>
        </button>
      {/each}
    {:else}
      {#each shownSpells as sp (sp.id)}
        <button class="rtab" class:active={sp.id === selectedSpellId} onclick={() => selectSpell(sp.id)}>
          <span class="tav glyphav">✦</span>
          <span class="tmeta">
            <span class="tn">{g(sp.name) || t('npcs.spellNamePlaceholder')}</span>
            <span class="tr">{spellMeta(sp) || '—'}</span>
          </span>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .rolodex {
    --card-paper: #e9e2cd;
    --card-paper2: #ded4b8;
    --card-ink: #2b241a;
    --card-ink-muted: #5c5240;
    --card-line: rgba(43, 36, 26, 0.18);
    --card-line2: rgba(43, 36, 26, 0.32);
    --card-red: #8f271d;
    --mono: 'Courier New', Courier, monospace;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* header */
  .rhead {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
  }
  .seg {
    display: flex;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--line2);
    border-radius: 9px;
    padding: 3px;
  }
  .segb {
    padding: 5px 15px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
  }
  .segb.on {
    background: rgba(47, 138, 102, 0.22);
    color: var(--green);
    box-shadow: inset 0 0 0 1px var(--green-dim);
  }
  .searchrow {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 220px;
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
  .in {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .spacer {
    flex: 1;
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
  .btn.on {
    border-color: var(--green-dim);
    background: rgba(47, 138, 102, 0.18);
    color: var(--green);
  }
  .btn.solid {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
    font-weight: 700;
  }
  .importwrap {
    flex: 0 0 auto;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }

  /* stage */
  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 18px;
    overflow: hidden;
    background: radial-gradient(680px 460px at 50% 42%, rgba(111, 208, 160, 0.05), transparent 65%);
  }
  .deckwrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    max-width: 100%;
    height: 100%;
  }
  .deck {
    position: relative;
    height: 100%;
    max-height: 720px;
    width: min(860px, 100%);
    display: flex;
  }
  /* fanned cards peeking out behind the front card */
  .peek {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    background: linear-gradient(155deg, var(--card-paper) 0%, var(--card-paper2) 100%);
    border: 1px solid rgba(43, 36, 26, 0.4);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
    filter: brightness(0.82) saturate(0.85);
    z-index: 1;
  }
  .peek1 {
    transform: rotate(-6deg) translate(-26px, 10px);
  }
  .peek2 {
    transform: rotate(5deg) translate(24px, 13px);
  }
  .peek3 {
    transform: rotate(-2.5deg) translate(-10px, 18px);
  }
  /* rolodex spindle rod behind the deck */
  .spindle {
    position: absolute;
    left: 50%;
    top: -9px;
    bottom: -9px;
    width: 6px;
    transform: translateX(-50%);
    border-radius: 3px;
    background: linear-gradient(90deg, #2b382f, #7f938a 45%, #2b382f);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    z-index: 0;
  }
  .spindle::before,
  .spindle::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 9px;
    border-radius: 50%;
    background: linear-gradient(180deg, #9aab9f, #55665d);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
  .spindle::before {
    top: -5px;
  }
  .spindle::after {
    bottom: -5px;
  }
  .navbtn {
    flex: 0 0 auto;
    align-self: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--line2);
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    color: var(--green);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .navbtn:hover:not(:disabled) {
    border-color: var(--green-dim);
    box-shadow: 0 0 0 1px var(--green-glow), 0 4px 14px rgba(0, 0, 0, 0.45);
  }
  .navbtn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  /* punch holes like a card-catalog card */
  .hole {
    position: absolute;
    top: 13px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #0b0d09, #1c1a12 70%);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.12);
    z-index: 5;
  }
  .hole.l {
    left: 24px;
  }
  .hole.r {
    right: 24px;
  }
  .card {
    position: relative;
    z-index: 2;
    width: min(860px, 100%);
    height: 100%;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--card-ink);
    background:
      radial-gradient(140% 100% at 15% 0%, rgba(255, 255, 255, 0.35), transparent 55%),
      linear-gradient(160deg, var(--card-paper) 0%, var(--card-paper2) 100%);
    border: 1px solid rgba(43, 36, 26, 0.35);
    box-shadow: 0 22px 46px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(255, 255, 255, 0.15) inset;
  }
  .card-scroll {
    position: relative;
    z-index: 2;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 28px 24px 10px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* edit form reads on the dark app surface, so give it a dark backing */
  .card.editmode {
    color: var(--txt);
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    border-color: var(--line2);
  }
  .spellform {
    gap: 8px;
  }
  .card.editmode :global(.si) {
    color: var(--muted);
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--card-line2);
  }
  .pini {
    font: 700 22px var(--serif, Georgia), serif;
    color: #6a5a34;
  }

  /* ===== Manila dossier masthead ===== */
  .card-top {
    position: relative;
    min-height: 158px;
  }
  /* diagonal rubber stamp over the top-right corner */
  .stamp {
    position: absolute;
    top: 34px;
    right: 18px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-family: var(--mono);
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--card-red);
    border: 3px double var(--card-red);
    border-radius: 4px;
    padding: 4px 13px;
    transform: rotate(-9deg);
    opacity: 0.66;
    pointer-events: none;
  }
  .stamp small {
    font-size: 7.5px;
    letter-spacing: 0.24em;
  }
  /* paper-clipped photo stack */
  .photostack {
    position: relative;
    flex: 0 0 auto;
    width: 116px;
    height: 150px;
    margin-top: 6px;
  }
  /* the clip is a sibling of the card inside .deck, so it can hook OVER the page's
     top edge (top loop above the paper, lower loop clamping page + photos). */
  .clip {
    position: absolute;
    top: -9px;
    left: 44px;
    width: 26px;
    height: 92px;
    z-index: 6;
    border: 5px solid #9aa0a7;
    border-radius: 13px;
    border-bottom-color: transparent;
    transform: rotate(-7deg);
    box-shadow: 0 3px 5px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }
  /* the sliver of clip that sits above the page edge reads as tucked behind it */
  .clip::before {
    content: '';
    position: absolute;
    left: -5px;
    right: -5px;
    top: 9px;
    height: 12px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.18), transparent);
    filter: blur(1px);
  }
  .snap {
    position: absolute;
    inset: 0;
    padding: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #fbf7ec;
    border: 6px solid #fbf7ec;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.42);
    cursor: pointer;
    transform: translate(calc(var(--i) * 15px), calc(var(--i) * 12px)) rotate(calc(var(--i) * 3.4deg));
    z-index: calc(20 - var(--i));
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .snap.primary {
    transform: rotate(-1.5deg);
    z-index: 20;
    cursor: default;
  }
  .snap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .snap.empty {
    background: rgba(43, 36, 26, 0.12);
    border-color: #fbf7ec;
  }
  /* a peeking photo slides aside on hover to reveal itself fully */
  .photostack.multi .snap:not(.primary):hover {
    transform: translate(128px, -6px) rotate(2.5deg);
    z-index: 30;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.55);
  }

  .fileline {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: var(--card-ink-muted);
    border-bottom: 1px solid var(--card-line2);
    padding-bottom: 4px;
    margin-bottom: 7px;
  }
  .fileline b {
    color: var(--card-ink);
    font-variant-numeric: tabular-nums;
  }
  .fileline .regsec {
    color: var(--card-red);
    font-weight: 700;
  }
  .subjlabel {
    font-family: var(--mono);
    font-size: 8.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--card-ink-muted);
    margin-bottom: 3px;
  }
  .card-id {
    flex: 1;
    min-width: 0;
  }
  .nm {
    font-family: var(--serif, Georgia), serif;
    font-size: 25px;
    font-weight: 700;
    line-height: 1.05;
    color: #1c170f;
  }
  .role {
    font-size: 12.5px;
    color: var(--card-ink-muted);
    font-style: italic;
    margin-top: 3px;
  }
  .tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2.5px 8px;
    border-radius: 20px;
    border: 1px solid;
  }
  .tag.ally {
    color: #1f7a4f;
    border-color: #1f7a4f;
    background: rgba(31, 122, 79, 0.1);
  }
  .tag.hostile {
    color: #9a3d3d;
    border-color: #9a3d3d;
    background: rgba(154, 61, 61, 0.1);
  }
  .tag.neutral {
    color: #93762c;
    border-color: #93762c;
    background: rgba(147, 118, 44, 0.1);
  }

  .fld .k {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--card-red);
    font-weight: 700;
    margin-bottom: 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid var(--card-line2);
  }
  .fld .k::before {
    content: '▍ ';
  }
  .fld .k.public {
    color: #1f7a4f;
  }
  .fld .v {
    font-size: 12.5px;
    color: #241f14;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .fld .v.quote {
    font-style: italic;
  }
  /* prose fields (blurb / GM notes) render as spaced paragraphs */
  .v.prose {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .v.prose p {
    margin: 0;
  }
  /* two-column card body: stat block beside the narrative text */
  .body2 {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 14px 24px;
    align-items: start;
  }
  .bcol {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .statgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(126px, 1fr));
    gap: 6px;
  }
  .sb {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    border: 1px solid var(--card-line2);
    border-radius: 6px;
    padding: 5px 8px;
    background: rgba(255, 255, 255, 0.28);
  }
  .sb .l {
    color: var(--card-ink-muted);
    text-transform: uppercase;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .sb .nnum {
    font-weight: 700;
    color: #1c170f;
    font-size: 13px;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .skillrow {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .sk {
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(43, 36, 26, 0.08);
    border: 1px solid var(--card-line);
    color: #241f14;
  }
  .sk b {
    color: #1c170f;
  }
  .chiprow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .dchip {
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    border: 1px solid var(--card-line2);
    background: rgba(255, 255, 255, 0.28);
    color: #241f14;
  }
  .dchip.san {
    color: #7a2f12;
    border-color: rgba(122, 47, 18, 0.4);
    background: rgba(122, 47, 18, 0.08);
  }
  .lines {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: #241f14;
  }
  .lines b {
    color: #1c170f;
  }
  .qty {
    color: #7a2f12;
    font-variant-numeric: tabular-nums;
  }
  .spellchip,
  .npcchip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: inherit;
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 20px;
    background: rgba(43, 36, 26, 0.07);
    border: 1px solid var(--card-line);
    color: #241f14;
    cursor: pointer;
  }
  .spellchip:hover,
  .npcchip:hover {
    background: rgba(31, 122, 79, 0.12);
    border-color: rgba(31, 122, 79, 0.4);
  }
  .npcchip .rd {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #93762c;
  }
  .npcchip .rd.ally {
    background: #1f7a4f;
  }
  .npcchip .rd.hostile {
    background: #9a3d3d;
  }
  .secret {
    border-radius: 7px;
    padding: 10px 12px;
    background:
      repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.035) 0 8px, transparent 8px 16px),
      rgba(20, 16, 10, 0.06);
    border: 1px dashed rgba(154, 61, 61, 0.55);
  }
  .secret .k {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #9a3d3d;
    font-weight: 800;
    margin-bottom: 4px;
  }
  .secret .v {
    font-size: 12px;
    color: #2b1414;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  /* spell card */
  .sp-top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--card-line2);
  }
  .glyph {
    width: 60px;
    height: 60px;
    flex: 0 0 auto;
    border-radius: 8px;
    border: 1px solid var(--card-line2);
    background: radial-gradient(circle at 50% 40%, rgba(199, 154, 58, 0.35), rgba(43, 36, 26, 0.1));
    display: grid;
    place-items: center;
    font-size: 26px;
    color: #7a2f12;
  }
  .metarow {
    margin-top: 8px;
  }
  .mtag {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 20px;
    border: 1px solid var(--card-line2);
    background: rgba(255, 255, 255, 0.28);
    color: #241f14;
  }
  .desc p {
    margin: 0 0 8px;
    font-family: var(--serif, Georgia), serif;
    font-size: 14.5px;
    line-height: 1.5;
    color: #241f14;
    white-space: pre-wrap;
  }
  .desc p:last-child {
    margin-bottom: 0;
  }
  .desc p:first-child::first-letter {
    font-size: 36px;
    float: left;
    line-height: 0.8;
    padding: 4px 8px 0 0;
    color: #7a2f12;
    font-weight: 700;
  }

  /* card foot */
  .card-foot {
    position: relative;
    z-index: 2;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-top: 1px solid var(--card-line);
  }
  .card.editmode .card-foot {
    border-top-color: var(--line);
  }
  .idx {
    font-size: 10.5px;
    color: var(--card-ink-muted);
    font-style: italic;
    font-variant-numeric: tabular-nums;
  }
  .card.editmode .idx {
    color: var(--faint);
  }
  .foot-btns {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }
  .cbtn {
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid var(--card-line2);
    background: rgba(255, 255, 255, 0.35);
    color: #241f14;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .cbtn:hover {
    background: rgba(255, 255, 255, 0.6);
  }
  .card.editmode .cbtn {
    background: rgba(0, 0, 0, 0.25);
    border-color: var(--line2);
    color: var(--txt);
  }
  .cbtn.dark {
    background: var(--green-dim);
    border-color: var(--green-dim);
    color: #06120c;
  }
  .cbtn.dark:hover {
    filter: brightness(1.08);
  }
  .cbtn.danger {
    background: rgba(180, 76, 60, 0.16);
    border-color: rgba(180, 76, 60, 0.5);
    color: #e6907f;
  }
  .rowflex {
    display: flex;
    gap: 8px;
  }
  .rowflex .in {
    flex: 1;
  }
  .rowflex.end {
    justify-content: flex-end;
  }
  .ta {
    min-height: 120px;
    resize: vertical;
    line-height: 1.45;
  }

  /* tab strip — overlapping manila document tabs, stacked like real files */
  .tabstrip {
    flex: 0 0 auto;
    height: 96px;
    border-top: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(12, 21, 18, 0.65), rgba(9, 15, 13, 0.65));
    display: flex;
    align-items: flex-end;
    gap: 0;
    padding: 0 22px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .rtab {
    flex: 0 0 auto;
    position: relative;
    width: 190px;
    height: 74px;
    margin-right: -16px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 22px 12px 12px;
    border: 1px solid rgba(43, 36, 26, 0.45);
    border-bottom: none;
    border-radius: 13px 13px 3px 3px;
    background: linear-gradient(180deg, #d7cbab 0%, #c5b995 100%);
    color: var(--card-ink);
    cursor: pointer;
    text-align: left;
    font: inherit;
    box-shadow: -7px 0 13px -7px rgba(0, 0, 0, 0.6);
    transition: transform 0.12s ease, height 0.12s ease;
  }
  /* the little folded corner where one document tucks behind the next */
  .rtab::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 16px;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(43, 36, 26, 0.12));
    border-radius: 0 13px 0 0;
    pointer-events: none;
  }
  .rtab:hover {
    transform: translateY(-4px);
  }
  .rtab.active {
    height: 90px;
    z-index: 6;
    transform: translateY(-6px);
    background: linear-gradient(180deg, var(--card-paper) 0%, #e4d9ba 100%);
    box-shadow: -5px -7px 16px -5px rgba(0, 0, 0, 0.55), 0 0 0 2px var(--green-dim);
  }
  .rtab.active::after {
    background: none;
  }
  .tav {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    border-radius: 7px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: rgba(43, 36, 26, 0.15);
    border: 1px solid var(--card-line2);
    font: 700 12px var(--serif, Georgia), serif;
    color: #6a5a34;
  }
  .tav img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .glyphav {
    font-size: 18px;
    color: #7a2f12;
  }
  .tmeta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .tn {
    font-family: var(--serif, Georgia), serif;
    font-size: 13px;
    font-weight: 700;
    color: #1c170f;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tr {
    font-size: 10px;
    color: var(--card-ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: auto;
    flex: 0 0 auto;
    background: #93762c;
  }
  .tdot.ally {
    background: #1f7a4f;
  }
  .tdot.hostile {
    background: #9a3d3d;
  }
</style>
