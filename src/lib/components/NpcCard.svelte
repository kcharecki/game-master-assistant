<script lang="ts">
  import type { Npc, Disposition } from '../../modules/npcs/store.svelte';
  import { spellLibrary } from '../../modules/npcs/spells.svelte';
  import { assetUrl } from '../db';
  import { t } from '../i18n';

  // GM-eyes-only read-only view of an NPC. Shows the FULL record — including
  // gmNotes and inventory — so it must never be used on the player broadcast.
  // `onPickImage` (optional) turns the gallery into a selector for the NPC's
  // broadcast portrait; the current one is highlighted.
  let { npc, onPickImage }: { npc: Npc; onPickImage?: (assetId: string) => void } = $props();

  const dispClass: Record<Disposition, string> = {
    ally: 'ally',
    neutral: 'neutral',
    hostile: 'hostile',
  };

  // Resolve every referenced asset id (primary + gallery) -> object URL,
  // revoking old ones on change (same pattern as npcs/Editor.svelte).
  let urls = $state<Record<string, string>>({});
  $effect(() => {
    const want = new Set<string>();
    if (npc.portraitId) want.add(npc.portraitId);
    for (const g of npc.gallery ?? []) want.add(g);
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

  const hasStats = $derived((npc.stats ?? []).some((s) => s.key || s.val));
  const hasEquip = $derived((npc.equipment ?? []).some((e) => e.name));
  const hasAttacks = $derived((npc.attacks ?? []).some((a) => a.name || a.chance || a.damage));
  const hasSkills = $derived((npc.skills ?? []).some((s) => s.name || s.value));
  // Resolve the NPC's spell references against the shared library (drop dangling ids).
  const spells = $derived(
    (npc.spellIds ?? []).map((id) => spellLibrary.get(id)).filter((s) => s !== undefined),
  );
  const gallery = $derived((npc.gallery ?? []).filter((g) => g !== npc.portraitId));
  // Every distinct image, in stable gallery order (so picking one only moves the
  // highlight, never reshuffles the strip). The primary is included even if it
  // somehow isn't in the gallery yet.
  const allImages = $derived(
    [...(npc.portraitId && !(npc.gallery ?? []).includes(npc.portraitId) ? [npc.portraitId] : []),
     ...(npc.gallery ?? [])].filter((v, i, a): v is string => !!v && a.indexOf(v) === i),
  );
</script>

<article class="npccard">
  <header class="head">
    <div class="port">
      {#if npc.portraitId && urls[npc.portraitId]}
        <img src={urls[npc.portraitId]} alt="" />
      {:else}
        <span class="ini">{npc.name.slice(0, 2).toUpperCase() || '??'}</span>
      {/if}
    </div>
    <div class="id">
      <div class="name">{npc.name || t('npcs.namePlaceholder')}</div>
      {#if npc.role}<div class="role">{npc.role}</div>{/if}
      <span class="disp {dispClass[npc.disposition]}">{t('npcs.disposition.' + npc.disposition)}</span>
    </div>
  </header>

  {#if npc.voice}
    <div class="line"><span class="vk">♪</span> {npc.voice}</div>
  {/if}

  {#if onPickImage && allImages.length > 1}
    <section>
      <div class="lbl">{t('npcs.broadcastImage')}</div>
      <div class="thumbs">
        {#each allImages as gid (gid)}
          {#if urls[gid]}
            <button
              type="button"
              class="pick"
              class:on={gid === npc.portraitId}
              title={t('npcs.broadcastImagePick')}
              onclick={() => onPickImage?.(gid)}
            >
              <img src={urls[gid]} alt="" />
            </button>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if hasStats}
    <section>
      <div class="lbl">{t('npcs.stats')}</div>
      <div class="stats">
        {#each npc.stats ?? [] as s (s.id)}
          {#if s.key || s.val}
            <div class="stat"><span class="sk">{s.key}</span><span class="sv">{s.val}</span></div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if hasAttacks}
    <section>
      <div class="lbl">{t('npcs.attacks')}</div>
      <ul class="attacks">
        {#each npc.attacks ?? [] as a (a.id)}
          {#if a.name || a.chance || a.damage}
            <li>
              <span class="an">{a.name}</span>
              {#if a.chance}<span class="ac">{a.chance}</span>{/if}
              {#if a.damage}<span class="ad">{a.damage}</span>{/if}
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if hasSkills}
    <section>
      <div class="lbl">{t('npcs.skills')}</div>
      <div class="stats">
        {#each npc.skills ?? [] as s (s.id)}
          {#if s.name || s.value}
            <div class="stat"><span class="sk">{s.name}</span><span class="sv">{s.value}</span></div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if npc.armor || npc.sanityLoss}
    <section>
      <div class="lbl">{t('npcs.defence')}</div>
      {#if npc.armor}<div class="line"><span class="dk">{t('npcs.armorShort')}</span> {npc.armor}</div>{/if}
      {#if npc.sanityLoss}<div class="line"><span class="dk">{t('npcs.sanityShort')}</span> {npc.sanityLoss}</div>{/if}
    </section>
  {/if}

  {#if hasEquip}
    <section>
      <div class="lbl">{t('npcs.equipment')}</div>
      <ul class="equip">
        {#each npc.equipment ?? [] as it (it.id)}
          {#if it.name}
            <li>
              <span class="en">{it.name}</span>{#if it.qty}<span class="eq">×{it.qty}</span>{/if}
              {#if it.notes}<span class="enote">— {it.notes}</span>{/if}
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if spells.length}
    <section>
      <div class="lbl">{t('npcs.spells')}</div>
      <ul class="spells">
        {#each spells as sp (sp.id)}
          <li>
            <div class="sphead">
              <span class="spn">{sp.name || t('npcs.spellNamePlaceholder')}</span>
              {#if sp.cost}<span class="spc">{sp.cost}</span>{/if}
              {#if sp.castingTime}<span class="spt">⏱ {sp.castingTime}</span>{/if}
            </div>
            {#if sp.description}<p class="spd">{sp.description}</p>{/if}
            {#if sp.altNames}<div class="spa">{sp.altNames}</div>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if npc.publicBlurb}
    <section>
      <div class="lbl public">{t('npcs.publicBlurb')}</div>
      <p class="body">{npc.publicBlurb}</p>
    </section>
  {/if}

  {#if npc.gmNotes}
    <section>
      <div class="lbl private">{t('npcs.gmNotes')}</div>
      <p class="body">{npc.gmNotes}</p>
    </section>
  {/if}

  {#if !onPickImage && gallery.length}
    <div class="thumbs">
      {#each gallery as gid (gid)}
        {#if urls[gid]}<img class="thumb" src={urls[gid]} alt="" />{/if}
      {/each}
    </div>
  {/if}
</article>

<style>
  .npccard {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--panel2, #10160f);
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--txt);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .port {
    flex: 0 0 auto;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
  }
  .port img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ini {
    font: 600 16px Georgia, serif;
    color: var(--green);
    letter-spacing: 1px;
  }
  .id {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-family: Georgia, serif;
    font-size: 16px;
    color: #e9f3ed;
    line-height: 1.15;
  }
  .role {
    font-size: 12px;
    color: var(--muted);
  }
  .disp {
    align-self: flex-start;
    margin-top: 2px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid var(--line2);
    color: var(--muted);
  }
  .disp.ally {
    color: #7fd6a8;
    border-color: rgba(47, 138, 102, 0.6);
    background: rgba(47, 138, 102, 0.14);
  }
  .disp.hostile {
    color: #e6907f;
    border-color: rgba(180, 76, 60, 0.6);
    background: rgba(180, 76, 60, 0.14);
  }
  .disp.neutral {
    color: var(--gold, #c7a44e);
    border-color: rgba(199, 164, 78, 0.5);
    background: rgba(199, 164, 78, 0.12);
  }
  .line {
    font-size: 12px;
    color: var(--txt);
  }
  .vk {
    color: var(--green);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .lbl {
    font-size: 10px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .lbl.public {
    color: var(--green);
  }
  .lbl.private {
    color: #d98c7a;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 4px;
  }
  .stat {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--line2);
    font-size: 11px;
  }
  .sk {
    color: var(--muted);
  }
  .sv {
    color: var(--txt);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .equip,
  .attacks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
  }
  .attacks li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }
  .attacks .an {
    color: var(--txt);
    font-weight: 600;
  }
  .attacks .ac {
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .attacks .ad {
    color: var(--gold, #c7a44e);
    font-variant-numeric: tabular-nums;
  }
  .dk {
    color: var(--muted);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .spells {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sphead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }
  .spn {
    color: var(--txt);
    font-weight: 600;
    font-size: 12px;
  }
  .spc {
    color: var(--green);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .spt {
    color: var(--gold, #c7a44e);
    font-size: 11px;
  }
  .spd {
    margin: 2px 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted);
    white-space: pre-wrap;
  }
  .spa {
    margin-top: 2px;
    font-size: 10px;
    font-style: italic;
    color: var(--faint, #6f6a5c);
  }
  .equip .eq {
    color: var(--gold, #c7a44e);
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
  }
  .equip .enote {
    color: var(--muted);
    margin-left: 4px;
  }
  .body {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--txt);
    white-space: pre-wrap;
  }
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--line2);
  }
  .pick {
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .pick img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pick:hover {
    border-color: var(--green-dim);
  }
  .pick.on {
    border-color: var(--gold, #c7a44e);
    box-shadow: 0 0 0 1px var(--gold, #c7a44e);
  }
</style>
