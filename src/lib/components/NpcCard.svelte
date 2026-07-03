<script lang="ts">
  import type { Npc, Disposition } from '../../modules/npcs/store.svelte';
  import { spellLibrary } from '../../modules/npcs/spells.svelte';
  import { assetUrl } from '../db';
  import { loc, paragraphs, type LocalizedText } from '../loc';
  import { lang } from '../stores/lang.svelte';
  import { t } from '../i18n';

  // Resolve a localized value in the active app language.
  const g = (v: LocalizedText | undefined | null) => loc(v, lang.current);
  // Resolve + split a localized value into paragraphs for prose fields.
  const ps = (v: LocalizedText | undefined | null) => paragraphs(v, lang.current);

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
  const initials = $derived(g(npc.name).slice(0, 2).toUpperCase() || '??');

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
  // The paper-clipped photo stack: primary first, then the rest of the gallery.
  const photos = $derived([
    ...(npc.portraitId ? [npc.portraitId] : []),
    ...(npc.gallery ?? []).filter((id) => id !== npc.portraitId),
  ]);
  // Every distinct image, in stable gallery order (so picking one only moves the
  // highlight, never reshuffles the strip). The primary is included even if it
  // somehow isn't in the gallery yet.
  const allImages = $derived(
    [...(npc.portraitId && !(npc.gallery ?? []).includes(npc.portraitId) ? [npc.portraitId] : []),
     ...(npc.gallery ?? [])].filter((v, i, a): v is string => !!v && a.indexOf(v) === i),
  );
</script>

<article class="dossier">
  <span class="stamp" aria-hidden="true">{t('npcs.stampTitle')}<small>{t('npcs.stampSub')}</small></span>

  <header class="dhead">
    <div class="photostack" class:multi={photos.length > 1}>
      <span class="clip" aria-hidden="true"></span>
      {#if photos.length}
        {#each photos as pid, i (pid)}
          <span class="snap" class:primary={i === 0} style="--i:{i}">
            {#if urls[pid]}<img src={urls[pid]} alt="" />{:else}<span class="ini">{initials}</span>{/if}
          </span>
        {/each}
      {:else}
        <span class="snap primary empty"><span class="ini">{initials}</span></span>
      {/if}
    </div>
    <div class="id">
      <div class="subj">{t('npcs.dossierSubject')}</div>
      <div class="name">{g(npc.name) || t('npcs.namePlaceholder')}</div>
      {#if g(npc.role)}<div class="role">{g(npc.role)}</div>{/if}
      <span class="disp {dispClass[npc.disposition]}">{t('npcs.disposition.' + npc.disposition)}</span>
    </div>
  </header>

  {#if g(npc.voice)}
    <div class="voice"><span class="vk">♪</span> {g(npc.voice)}</div>
  {/if}

  {#if onPickImage && allImages.length > 1}
    <section>
      <div class="h">{t('npcs.broadcastImage')}</div>
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
      <div class="h">{t('npcs.stats')}</div>
      <div class="stats">
        {#each npc.stats ?? [] as s (s.id)}
          {#if g(s.key) || g(s.val)}
            <div class="sb"><span class="sk">{g(s.key)}</span><span class="sv">{g(s.val)}</span></div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if hasAttacks}
    <section>
      <div class="h">{t('npcs.attacks')}</div>
      <ul class="lines">
        {#each npc.attacks ?? [] as a (a.id)}
          {#if g(a.name) || g(a.chance) || g(a.damage)}
            <li>
              <span class="an">{g(a.name)}</span>
              {#if g(a.chance)}<span class="ac">{g(a.chance)}</span>{/if}
              {#if g(a.damage)}<span class="ad">{g(a.damage)}</span>{/if}
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if hasSkills}
    <section>
      <div class="h">{t('npcs.skills')}</div>
      <div class="chips">
        {#each npc.skills ?? [] as s (s.id)}
          {#if g(s.name) || g(s.value)}
            <span class="chip"><b>{g(s.name)}</b> {g(s.value)}</span>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if g(npc.armor) || g(npc.sanityLoss)}
    <section>
      <div class="h">{t('npcs.defence')}</div>
      {#if g(npc.armor)}<div class="line"><span class="dk">{t('npcs.armorShort')}</span> {g(npc.armor)}</div>{/if}
      {#if g(npc.sanityLoss)}<div class="line"><span class="dk">{t('npcs.sanityShort')}</span> {g(npc.sanityLoss)}</div>{/if}
    </section>
  {/if}

  {#if hasEquip}
    <section>
      <div class="h">{t('npcs.equipment')}</div>
      <ul class="lines">
        {#each npc.equipment ?? [] as it (it.id)}
          {#if g(it.name)}
            <li>
              <span class="an">{g(it.name)}</span>{#if it.qty}<span class="qty">×{it.qty}</span>{/if}
              {#if g(it.notes)}<span class="enote">— {g(it.notes)}</span>{/if}
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if spells.length}
    <section>
      <div class="h">{t('npcs.spells')}</div>
      <ul class="spells">
        {#each spells as sp (sp.id)}
          <li>
            <div class="sphead">
              <span class="spn">{g(sp.name) || t('npcs.spellNamePlaceholder')}</span>
              {#if g(sp.cost)}<span class="spc">{g(sp.cost)}</span>{/if}
              {#if g(sp.castingTime)}<span class="spt">⏱ {g(sp.castingTime)}</span>{/if}
            </div>
            {#if g(sp.description)}<p class="spd">{g(sp.description)}</p>{/if}
            {#if g(sp.altNames)}<div class="spa">{g(sp.altNames)}</div>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if g(npc.publicBlurb)}
    <section>
      <div class="h public">{t('npcs.publicBlurb')}</div>
      <div class="prose">{#each ps(npc.publicBlurb) as para}<p class="body">{para}</p>{/each}</div>
    </section>
  {/if}

  {#if g(npc.gmNotes)}
    <section class="secret">
      <div class="h private"><span>👁</span> {t('npcs.gmNotes')}</div>
      <div class="prose">{#each ps(npc.gmNotes) as para}<p class="body">{para}</p>{/each}</div>
    </section>
  {/if}
</article>

<style>
  .dossier {
    --paper: #e9e2cd;
    --paper2: #ded4b8;
    --ink: #2b241a;
    --ink-muted: #5c5240;
    --line: rgba(43, 36, 26, 0.18);
    --line2: rgba(43, 36, 26, 0.32);
    --red: #8f271d;
    --mono: 'Courier New', Courier, monospace;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 16px 13px 13px;
    color: var(--ink);
    background:
      radial-gradient(140% 100% at 15% 0%, rgba(255, 255, 255, 0.35), transparent 55%),
      linear-gradient(160deg, var(--paper) 0%, var(--paper2) 100%);
    border: 1px solid rgba(43, 36, 26, 0.35);
    border-radius: 0 0 12px 12px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
  }

  /* rubber stamp, top-right corner */
  .stamp {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--red);
    border: 2px double var(--red);
    border-radius: 3px;
    padding: 2px 8px;
    transform: rotate(-8deg);
    opacity: 0.6;
    pointer-events: none;
  }
  .stamp small {
    font-size: 6px;
    letter-spacing: 0.18em;
  }

  /* masthead */
  .dhead {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding-bottom: 9px;
    border-bottom: 2px solid var(--line2);
  }
  .photostack {
    position: relative;
    flex: 0 0 auto;
    width: 66px;
    height: 84px;
    margin-top: 2px;
  }
  .clip {
    position: absolute;
    top: -13px;
    left: 12px;
    width: 17px;
    height: 52px;
    z-index: 40;
    border: 4px solid #9aa0a7;
    border-radius: 9px;
    border-bottom-color: transparent;
    transform: rotate(-7deg);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }
  .snap {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #fbf7ec;
    border: 4px solid #fbf7ec;
    box-shadow: 0 5px 12px rgba(0, 0, 0, 0.42);
    transform: translate(calc(var(--i) * 9px), calc(var(--i) * 7px)) rotate(calc(var(--i) * 3.4deg));
    z-index: calc(20 - var(--i));
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .snap.primary {
    transform: rotate(-1.5deg);
    z-index: 20;
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
  .photostack.multi .snap:not(.primary):hover {
    transform: translate(72px, -4px) rotate(2.5deg);
    z-index: 30;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.55);
  }
  .ini {
    font: 700 18px var(--serif, Georgia), serif;
    color: #6a5a34;
  }
  .id {
    min-width: 0;
    flex: 1;
    padding-top: 1px;
  }
  .subj {
    font-family: var(--mono);
    font-size: 7.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 2px;
  }
  .name {
    font-family: var(--serif, Georgia), serif;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.08;
    color: #1c170f;
  }
  .role {
    font-size: 11px;
    font-style: italic;
    color: var(--ink-muted);
    margin-top: 2px;
  }
  .disp {
    display: inline-block;
    margin-top: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 20px;
    border: 1px solid;
  }
  .disp.ally {
    color: #1f7a4f;
    border-color: #1f7a4f;
    background: rgba(31, 122, 79, 0.1);
  }
  .disp.hostile {
    color: #9a3d3d;
    border-color: #9a3d3d;
    background: rgba(154, 61, 61, 0.1);
  }
  .disp.neutral {
    color: #93762c;
    border-color: #93762c;
    background: rgba(147, 118, 44, 0.1);
  }

  .voice {
    font-size: 11.5px;
    font-style: italic;
    color: #241f14;
  }
  .vk {
    color: var(--red);
    font-style: normal;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  /* typewriter red section head with a ruled underline */
  .h {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--red);
    font-weight: 700;
    padding-bottom: 3px;
    border-bottom: 1px solid var(--line2);
  }
  .h::before {
    content: '▍ ';
  }
  .h.public {
    color: #1f7a4f;
  }
  .h.private {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--red);
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .sb {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    align-items: baseline;
    padding: 3px 7px;
    border: 1px solid var(--line2);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.28);
  }
  .sk {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }
  .sv {
    font-weight: 700;
    font-size: 12px;
    color: #1c170f;
    font-variant-numeric: tabular-nums;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .lines {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11.5px;
    color: #241f14;
  }
  .lines li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }
  .an {
    color: #1c170f;
    font-weight: 700;
  }
  .ac {
    color: #1f7a4f;
    font-variant-numeric: tabular-nums;
  }
  .ad {
    color: #93762c;
    font-variant-numeric: tabular-nums;
  }
  .qty {
    color: var(--red);
    font-variant-numeric: tabular-nums;
  }
  .enote {
    color: var(--ink-muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(43, 36, 26, 0.08);
    border: 1px solid var(--line);
    color: #241f14;
  }
  .chip b {
    color: #1c170f;
  }

  .line {
    font-size: 11.5px;
    color: #241f14;
  }
  .dk {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }

  .spells {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .sphead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }
  .spn {
    color: #1c170f;
    font-weight: 700;
    font-size: 11.5px;
  }
  .spc {
    color: #1f7a4f;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .spt {
    color: #93762c;
    font-size: 10.5px;
  }
  .spd {
    margin: 2px 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--ink-muted);
    white-space: pre-wrap;
  }
  .spa {
    margin-top: 2px;
    font-size: 9.5px;
    font-style: italic;
    color: #8a7f66;
  }

  .prose {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .body {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.42;
    color: #241f14;
    white-space: pre-wrap;
  }

  /* GM-only block: hatched paper + dashed red frame, like the note's secret box */
  .secret {
    border-radius: 6px;
    padding: 8px 10px;
    background:
      repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.035) 0 8px, transparent 8px 16px),
      rgba(20, 16, 10, 0.06);
    border: 1px dashed rgba(154, 61, 61, 0.55);
  }
  .secret .body {
    color: #2b1414;
  }

  /* broadcast-image picker */
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .pick {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid var(--line2);
    background: rgba(255, 255, 255, 0.3);
    cursor: pointer;
  }
  .pick img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pick:hover {
    border-color: var(--red);
  }
  .pick.on {
    border-color: #93762c;
    box-shadow: 0 0 0 1px #93762c;
  }
</style>
