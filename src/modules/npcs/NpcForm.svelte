<script lang="ts">
  import { npcs, type Disposition, type Npc } from './store.svelte';
  import { spellLibrary } from './spells.svelte';
  import { parseSpells, SPELL_PROMPT } from './import';
  import { assetPut, assetUrl } from '../../lib/db';
  import { loc, setLoc, type LocalizedText } from '../../lib/loc';
  import { lang } from '../../lib/stores/lang.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';
  import ImportPanel from '../../lib/components/ImportPanel.svelte';

  // The full GM-only editing form for ONE NPC. Extracted from the old master/
  // detail Editor so the Rolodex can flip a card into edit mode and back.
  let { npc }: { npc: Npc } = $props();

  const g = (v: LocalizedText | undefined) => loc(v, lang.current);
  const sl = (v: LocalizedText | undefined, text: string) => setLoc(v, lang.current, text);
  const dispositions: Disposition[] = ['ally', 'neutral', 'hostile'];

  // Which attached spells have their inline edit panel expanded.
  let spellEdit = $state<Record<string, boolean>>({});
  let showSpellImport = $state(false);

  // Resolve this NPC's referenced asset ids (primary + gallery) -> object URLs,
  // revoking old ones on change; free everything on unmount.
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    if (npc.portraitId) want.add(npc.portraitId);
    for (const gid of npc.gallery ?? []) want.add(gid);
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

  async function pickPortrait(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.setPrimaryPhoto(npc.id, assetId);
  }
  async function addToGallery(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const assetId = await assetPut(file, file.type);
    npcs.addPhoto(npc.id, assetId);
  }

  function newSpell() {
    const spell = spellLibrary.add('');
    npcs.attachSpell(npc.id, spell.id);
    spellEdit[spell.id] = true;
  }
  function attachSpell(spellId: string) {
    if (spellId) npcs.attachSpell(npc.id, spellId);
  }

  function importSpellJson(raw: string): { ok: boolean; message: string } {
    const { items, error } = parseSpells(raw);
    if (error) {
      return {
        ok: false,
        message: t(error === 'invalid-json' ? 'jsonImport.invalidJson' : 'jsonImport.noSpells'),
      };
    }
    const created = spellLibrary.importMany(items);
    for (const s of created) npcs.attachSpell(npc.id, s.id);
    showSpellImport = false;
    return { ok: true, message: `${t('jsonImport.importedSpells')} ${created.length}` };
  }
</script>

<div class="npcform">
  <div class="portrow">
    <label class="port" title={t('npcs.uploadPortrait')}>
      {#if npc.portraitId && urls[npc.portraitId]}
        <img class="pimg" src={urls[npc.portraitId]} alt="{g(npc.name)} portrait" />
      {:else}
        <span class="pinit">{g(npc.name).slice(0, 2).toUpperCase() || '??'}</span>
      {/if}
      <input
        type="file"
        accept="image/*"
        hidden
        onchange={(e) => void pickPortrait(e.currentTarget.files?.[0])}
      />
    </label>
    <div class="pfields">
      <input
        class="in name"
        value={g(npc.name)}
        oninput={(e) => npcs.update(npc.id, { name: sl(npc.name, e.currentTarget.value) })}
        placeholder={t('npcs.namePlaceholder')}
      />
      <input
        class="in"
        value={g(npc.role)}
        oninput={(e) => npcs.update(npc.id, { role: sl(npc.role, e.currentTarget.value) })}
        placeholder={t('npcs.rolePlaceholder')}
      />
      <div class="rowflex">
        <select
          class="in"
          value={npc.disposition}
          onchange={(e) => npcs.update(npc.id, { disposition: e.currentTarget.value as Disposition })}
        >
          {#each dispositions as d (d)}<option value={d}>{t('npcs.disposition.' + d)}</option>{/each}
        </select>
        <button class="btn danger" onclick={() => npcs.remove(npc.id)}>
          <Icon name="trash" /> {t('npcs.delete')}
        </button>
      </div>
    </div>
  </div>

  <input
    class="in"
    value={g(npc.voice)}
    oninput={(e) => npcs.update(npc.id, { voice: sl(npc.voice, e.currentTarget.value) })}
    placeholder={t('npcs.voicePlaceholder')}
  />

  <!-- Gallery -->
  <section class="sec">
    <div class="seclabel">{t('npcs.gallery')}</div>
    <div class="thumbs">
      {#each npc.gallery ?? [] as gid (gid)}
        <div class="thumb" class:primary={gid === npc.portraitId}>
          {#if urls[gid]}
            <button
              type="button"
              class="thumbpick"
              title={t('npcs.setPrimary')}
              onclick={() => npcs.setPrimaryPhoto(npc.id, gid)}
            >
              <img src={urls[gid]} alt="" />
            </button>
          {/if}
          <button
            type="button"
            class="thumbx"
            aria-label={t('npcs.removePhoto')}
            onclick={() => npcs.removePhoto(npc.id, gid)}>×</button
          >
        </div>
      {/each}
      <label class="thumb addthumb" title={t('npcs.addPhoto')}>
        ＋
        <input
          type="file"
          accept="image/*"
          hidden
          onchange={(e) => void addToGallery(e.currentTarget.files?.[0])}
        />
      </label>
    </div>
  </section>

  <!-- Characteristics -->
  <section class="sec">
    <div class="seclabel">
      {t('npcs.stats')}
      <button class="mini" onclick={() => npcs.addStat(npc.id)}>{t('npcs.addRow')}</button>
    </div>
    {#each npc.stats ?? [] as s (s.id)}
      <div class="statrow">
        <input
          class="in"
          value={g(s.key)}
          oninput={(e) => npcs.updateStat(npc.id, s.id, { key: sl(s.key, e.currentTarget.value) })}
          placeholder={t('npcs.statKeyPlaceholder')}
        />
        <input
          class="in"
          value={g(s.val)}
          oninput={(e) => npcs.updateStat(npc.id, s.id, { val: sl(s.val, e.currentTarget.value) })}
          placeholder={t('npcs.statValPlaceholder')}
        />
        <button class="mini" aria-label={t('npcs.removeStat')} onclick={() => npcs.removeStat(npc.id, s.id)}>×</button>
      </div>
    {/each}
  </section>

  <!-- Attacks -->
  <section class="sec">
    <div class="seclabel">
      {t('npcs.attacks')}
      <button class="mini" onclick={() => npcs.addAttack(npc.id)}>{t('npcs.addRow')}</button>
    </div>
    {#each npc.attacks ?? [] as a (a.id)}
      <div class="attackrow">
        <input
          class="in"
          value={g(a.name)}
          oninput={(e) => npcs.updateAttack(npc.id, a.id, { name: sl(a.name, e.currentTarget.value) })}
          placeholder={t('npcs.attackNamePlaceholder')}
        />
        <input
          class="in"
          value={g(a.chance)}
          oninput={(e) => npcs.updateAttack(npc.id, a.id, { chance: sl(a.chance, e.currentTarget.value) })}
          placeholder={t('npcs.attackChancePlaceholder')}
        />
        <input
          class="in"
          value={g(a.damage)}
          oninput={(e) => npcs.updateAttack(npc.id, a.id, { damage: sl(a.damage, e.currentTarget.value) })}
          placeholder={t('npcs.attackDamagePlaceholder')}
        />
        <button class="mini" aria-label={t('npcs.removeAttack')} onclick={() => npcs.removeAttack(npc.id, a.id)}>×</button>
      </div>
    {/each}
  </section>

  <!-- Skills -->
  <section class="sec">
    <div class="seclabel">
      {t('npcs.skills')}
      <button class="mini" onclick={() => npcs.addSkill(npc.id)}>{t('npcs.addRow')}</button>
    </div>
    {#each npc.skills ?? [] as sk (sk.id)}
      <div class="statrow">
        <input
          class="in"
          value={g(sk.name)}
          oninput={(e) => npcs.updateSkill(npc.id, sk.id, { name: sl(sk.name, e.currentTarget.value) })}
          placeholder={t('npcs.skillNamePlaceholder')}
        />
        <input
          class="in"
          value={g(sk.value)}
          oninput={(e) => npcs.updateSkill(npc.id, sk.id, { value: sl(sk.value, e.currentTarget.value) })}
          placeholder={t('npcs.skillValPlaceholder')}
        />
        <button class="mini" aria-label={t('npcs.removeSkill')} onclick={() => npcs.removeSkill(npc.id, sk.id)}>×</button>
      </div>
    {/each}
  </section>

  <!-- Armor + Sanity loss -->
  <section class="sec">
    <div class="seclabel">{t('npcs.defence')}</div>
    <div class="rowflex">
      <input
        class="in"
        value={g(npc.armor)}
        oninput={(e) => npcs.update(npc.id, { armor: sl(npc.armor, e.currentTarget.value) })}
        placeholder={t('npcs.armorPlaceholder')}
      />
      <input
        class="in"
        value={g(npc.sanityLoss)}
        oninput={(e) => npcs.update(npc.id, { sanityLoss: sl(npc.sanityLoss, e.currentTarget.value) })}
        placeholder={t('npcs.sanityLossPlaceholder')}
      />
    </div>
  </section>

  <!-- Inventory -->
  <section class="sec">
    <div class="seclabel">
      {t('npcs.equipment')}
      <button class="mini" onclick={() => npcs.addEquip(npc.id)}>{t('npcs.addRow')}</button>
    </div>
    {#each npc.equipment ?? [] as it (it.id)}
      <div class="equiprow">
        <input
          class="in"
          value={g(it.name)}
          oninput={(e) => npcs.updateEquip(npc.id, it.id, { name: sl(it.name, e.currentTarget.value) })}
          placeholder={t('npcs.itemPlaceholder')}
        />
        <input
          class="in qty"
          type="number"
          value={it.qty ?? ''}
          oninput={(e) =>
            npcs.updateEquip(npc.id, it.id, {
              qty: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value),
            })}
          placeholder={t('npcs.qtyPlaceholder')}
        />
        <input
          class="in"
          value={g(it.notes)}
          oninput={(e) => npcs.updateEquip(npc.id, it.id, { notes: sl(it.notes, e.currentTarget.value) })}
          placeholder={t('npcs.notesPlaceholder')}
        />
        <button class="mini" aria-label={t('npcs.removeItem')} onclick={() => npcs.removeEquip(npc.id, it.id)}>×</button>
      </div>
    {/each}
  </section>

  <!-- Spells (references into the shared library) -->
  <section class="sec">
    <div class="seclabel">
      {t('npcs.spells')}
      <button class="mini" onclick={() => (showSpellImport = !showSpellImport)}>{t('npcs.import')}</button>
      <button class="mini" onclick={newSpell}>{t('npcs.newSpell')}</button>
    </div>
    {#if showSpellImport}
      <ImportPanel
        promptText={SPELL_PROMPT}
        placeholder={t('npcs.spellImportPlaceholder')}
        onImport={importSpellJson}
      />
    {/if}
    {#each (npc.spellIds ?? []).map((id) => spellLibrary.get(id)).filter((s) => s !== undefined) as sp (sp.id)}
      <div class="spellrow">
        <button
          class="spellname"
          aria-expanded={!!spellEdit[sp.id]}
          onclick={() => (spellEdit[sp.id] = !spellEdit[sp.id])}
        >
          <Icon name="chevron" size={12} class={spellEdit[sp.id] ? 'chev open' : 'chev'} />
          {g(sp.name) || t('npcs.spellNamePlaceholder')}
        </button>
        <span class="spellmeta">{[g(sp.cost), g(sp.castingTime)].filter(Boolean).join(' · ')}</span>
        <button
          class="mini"
          aria-label={t('npcs.detachSpell')}
          title={t('npcs.detachSpell')}
          onclick={() => npcs.detachSpell(npc.id, sp.id)}>×</button
        >
      </div>
      {#if spellEdit[sp.id]}
        <div class="spelledit">
          <input
            class="in"
            value={g(sp.name)}
            oninput={(e) => spellLibrary.update(sp.id, { name: sl(sp.name, e.currentTarget.value) })}
            placeholder={t('npcs.spellNamePlaceholder')}
          />
          <div class="rowflex">
            <input
              class="in"
              value={g(sp.cost)}
              oninput={(e) => spellLibrary.update(sp.id, { cost: sl(sp.cost, e.currentTarget.value) })}
              placeholder={t('npcs.spellCostPlaceholder')}
            />
            <input
              class="in"
              value={g(sp.castingTime)}
              oninput={(e) => spellLibrary.update(sp.id, { castingTime: sl(sp.castingTime, e.currentTarget.value) })}
              placeholder={t('npcs.spellTimePlaceholder')}
            />
          </div>
          <input
            class="in"
            value={g(sp.altNames)}
            oninput={(e) => spellLibrary.update(sp.id, { altNames: sl(sp.altNames, e.currentTarget.value) })}
            placeholder={t('npcs.spellAltPlaceholder')}
          />
          <textarea
            class="in ta"
            value={g(sp.description)}
            oninput={(e) => spellLibrary.update(sp.id, { description: sl(sp.description, e.currentTarget.value) })}
            placeholder={t('npcs.spellDescPlaceholder')}
          ></textarea>
          <div class="muted small">{t('npcs.spellShared')}</div>
        </div>
      {/if}
    {/each}

    {#if spellLibrary.list.some((s) => !(npc.spellIds ?? []).includes(s.id))}
      <select
        class="in"
        value=""
        onchange={(e) => {
          attachSpell(e.currentTarget.value);
          e.currentTarget.value = '';
        }}
      >
        <option value="">{t('npcs.addFromLibrary')}</option>
        {#each spellLibrary.list.filter((s) => !(npc.spellIds ?? []).includes(s.id)) as s (s.id)}
          <option value={s.id}>{g(s.name) || t('npcs.spellNamePlaceholder')}</option>
        {/each}
      </select>
    {/if}
  </section>

  <!-- Public blurb -->
  <section class="sec">
    <div class="seclabel public">{t('npcs.publicBlurb')}</div>
    <textarea
      class="in ta"
      value={g(npc.publicBlurb)}
      oninput={(e) => npcs.update(npc.id, { publicBlurb: sl(npc.publicBlurb, e.currentTarget.value) })}
      placeholder={t('npcs.publicBlurbPlaceholder')}
    ></textarea>
  </section>

  <!-- GM notes -->
  <section class="sec">
    <div class="seclabel private">{t('npcs.gmNotes')}</div>
    <textarea
      class="in ta"
      value={g(npc.gmNotes)}
      oninput={(e) => npcs.update(npc.id, { gmNotes: sl(npc.gmNotes, e.currentTarget.value) })}
      placeholder={t('npcs.gmNotesPlaceholder')}
    ></textarea>
  </section>
</div>

<style>
  .npcform {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    border-radius: var(--r4);
    border: 1px solid var(--line2);
    background: var(--bg1);
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
    font: 600 24px var(--serif), Georgia, serif;
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
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
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
    border-top: 1px solid var(--line1);
  }
  .seclabel {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }
  .seclabel.public {
    color: var(--green);
  }
  .seclabel.private {
    color: var(--red);
  }
  .mini {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: var(--r1);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .mini:hover {
    background: var(--fill-g14);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .btn:hover {
    background: var(--fill-g08);
  }
  .btn.danger {
    flex: 0 0 auto;
  }
  .btn.danger:hover {
    background: var(--fill-red);
    border-color: var(--red-dim);
    color: var(--red);
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
    border-radius: var(--r2);
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
    background: var(--bg1);
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
    background: var(--bg1);
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
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 11px;
  }
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
