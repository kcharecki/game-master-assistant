<script lang="ts">
  import { onMount } from 'svelte';
  import KeeperEye from './KeeperEye.svelte';
  import Roller from '../modules/roller/Desktop.svelte';
  import { moduleList } from '../lib/registry';
  import { t } from '../lib/i18n';
  import type { ModuleId } from '../lib/module';
  import {
    exportCampaign,
    importCampaign,
    parseCampaign,
    campaignToJson,
    estimateQuota,
    type QuotaInfo,
  } from '../lib/backup';

  let {
    activeView,
    onShowDesktop,
    onOpenEditor,
  }: {
    activeView: string;
    onShowDesktop: () => void;
    onOpenEditor: (id: ModuleId) => void;
  } = $props();

  // Asset-setup rail = modules that expose an editor.
  const editable = moduleList.filter((m) => m.editor);

  let quota = $state<QuotaInfo | null>(null);
  let status = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  async function refreshQuota() {
    quota = await estimateQuota();
  }

  onMount(refreshQuota);

  async function doExport() {
    const file = await exportCampaign();
    const blob = new Blob([campaignToJson(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    status = t('sidebar.exported');
  }

  async function onImportFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = parseCampaign(JSON.parse(await file.text()));
      await importCampaign(parsed);
      status = t('sidebar.imported');
    } catch (err) {
      status = `${t('sidebar.importFailedPre')}${(err as Error).message}`;
    }
  }

  function fmtBytes(n: number): string {
    if (!n) return '—';
    const mb = n / 1_048_576;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
  }

  const storePct = $derived(
    quota && quota.quota ? Math.min(100, Math.round((quota.usage / quota.quota) * 100)) : 0,
  );

  // Silent, scaled-down mirror of the screen-shared broadcast page (?preview=1 →
  // visuals only, no audio), so the GM always sees exactly what players see.
  const SRCW = 1280;
  const SRCH = 800;
  let pvW = $state(0);
  const pvScale = $derived(pvW > 0 ? pvW / SRCW : 0);
</script>

{#snippet navicon(id: ModuleId)}
  {#if id === 'npcs'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="7" cy="4.8" r="2.2" /><path d="M2.6 12c.7-2.6 8.1-2.6 8.8 0" /></svg>
  {:else if id === 'lore'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="7" cy="7" r="5" /><path d="M2 7h10" /><path d="M7 2c-2.6 3-2.6 7 0 10" /></svg>
  {:else if id === 'reveal'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1.5 7C3.5 4 10.5 4 12.5 7C10.5 10 3.5 10 1.5 7Z" /><circle cx="7" cy="7" r="1.6" /></svg>
  {:else if id === 'audio'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.3h2.2L8 2.8v8.4L4.7 8.7H2.5z" /><path d="M10 5a3 3 0 0 1 0 4" /></svg>
  {:else if id === 'notebook'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2.5" y="1.5" width="9" height="11" rx="1" /><path d="M5 5h4M5 7.5h4" /></svg>
  {:else if id === 'planner'}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1.5" y="2.5" width="11" height="10" rx="1" /><path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" /></svg>
  {:else}
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="2" width="10" height="10" rx="1.5" /></svg>
  {/if}
{/snippet}

{#snippet zoneLabel(text: string)}
  <div class="rk-label"><span>{text}</span><span class="rk-rule"></span></div>
{/snippet}

<aside class="sidebar">
  <div class="rk-word">
    <svg class="rk-eye" viewBox="0 0 14 14" fill="none" stroke="var(--green)" stroke-width="1.1" stroke-linecap="round"><path d="M1.5 7C3.5 4 10.5 4 12.5 7C10.5 10 3.5 10 1.5 7Z" /><circle cx="7" cy="7" r="1.6" /></svg>
    <div class="rk-wordtext">
      <div class="rk-wordmark">GM ASSISTANT</div>
      <div class="rk-tagline">{t('sidebar.tagline')}</div>
    </div>
  </div>

  <nav class="nav">
    <a
      class:active={activeView === 'desktop'}
      href="#desktop"
      onclick={(e) => {
        e.preventDefault();
        onShowDesktop();
      }}
      ><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1.5" y="2.5" width="11" height="7.5" rx="1" /><path d="M5 12.5h4" /></svg><span>{t('sidebar.desktop')}</span></a
    >
    {@render zoneLabel(t('sidebar.modules'))}
    {#each editable as m (m.id)}
      <a
        class:active={activeView === m.id}
        href="#{m.id}"
        onclick={(e) => {
          e.preventDefault();
          onOpenEditor(m.id);
        }}
        >{@render navicon(m.id)}<span>{t('mod.' + m.id + '.title')}</span></a
      >
    {/each}
  </nav>

  <div class="rk-zone">
    {@render zoneLabel(t('sidebar.campaign'))}
    <div class="rk-brow">
      <button class="rk-util" onclick={doExport}>{t('sidebar.export')}</button>
      <button class="rk-util" onclick={() => fileInput?.click()}>{t('sidebar.import')}</button>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json"
      class="rk-hidden"
      onchange={onImportFile}
    />
    <button class="rk-stor" onclick={refreshQuota} title={t('sidebar.checkStorage')}>
      <div class="rk-storhead">
        <span class="rk-storlabel">{t('sidebar.storage')}</span>
        <span class="rk-stortext">
          {#if quota}
            {fmtBytes(quota.usage)}{t('sidebar.storageSep')}{fmtBytes(quota.quota)}
          {:else}—{/if}
        </span>
      </div>
      <div class="rk-bar"><div class="rk-fill" style="width:{storePct}%"></div></div>
      {#if quota?.nearLimit}<span class="rk-warn">{t('sidebar.nearLimit')}</span>{/if}
    </button>
    {#if status}<div class="rk-status">{status}</div>{/if}
  </div>

  <div class="rk-zone">
    {@render zoneLabel(t('sidebar.onair'))}
    <div class="pvwrap" bind:clientWidth={pvW} style="aspect-ratio:{SRCW}/{SRCH}">
      <iframe
        class="pvframe"
        title={t('preview.title')}
        src="broadcast.html?preview=1"
        style="width:{SRCW}px;height:{SRCH}px;transform:scale({pvScale})"
      ></iframe>
      <span class="pvtag">{t('preview.live')}</span>
    </div>
    <div class="rk-caption">{t('sidebar.playersSee')}</div>
  </div>

  <div class="rk-zone rk-roll">
    {@render zoneLabel(t('sidebar.quickroll'))}
    <Roller />
  </div>

  <div class="rk-keeper">
    <KeeperEye />
  </div>
</aside>

<style>
  .sidebar {
    gap: 4px;
  }
  .rk-word {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 8px 12px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 6px;
    flex-shrink: 0;
  }
  .rk-eye {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  .rk-wordtext {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .rk-wordmark {
    font-size: 10.5px;
    letter-spacing: 0.18em;
    font-weight: 700;
    color: var(--txt);
  }
  .rk-tagline {
    font-family: var(--serif);
    font-style: italic;
    font-size: 11.5px;
    color: var(--faint);
  }

  /* Nav icons (global .nav a supplies layout + active state). */
  .nav a :global(svg) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.85;
  }

  /* Section label with trailing rule. */
  .rk-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 7px;
    margin: 12px 0 7px;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 600;
    white-space: nowrap;
  }
  .rk-rule {
    height: 1px;
    flex: 1;
    min-width: 8px;
    background: var(--line);
  }

  .rk-zone {
    padding: 0 5px 6px;
    flex-shrink: 0;
  }

  .rk-brow {
    display: flex;
    gap: 6px;
  }
  .rk-util {
    flex: 1;
    text-align: center;
    padding: 5px 0;
    font: inherit;
    font-size: 11px;
    letter-spacing: 0.02em;
    color: var(--muted);
    border: 1px solid var(--line);
    border-radius: var(--r2);
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rk-util:hover {
    color: var(--txt);
    border-color: var(--line2);
    background: var(--fill-g08);
  }
  .rk-hidden {
    display: none;
  }

  .rk-stor {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .rk-storhead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .rk-storlabel {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .rk-stortext {
    font-size: 10px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .rk-bar {
    height: 3px;
    border-radius: var(--r-pill);
    background: rgba(111, 208, 160, 0.1);
    overflow: hidden;
  }
  .rk-fill {
    height: 100%;
    min-width: 4px;
    background: var(--green);
    border-radius: var(--r-pill);
    transition: width 0.4s;
  }
  .rk-warn {
    display: inline-block;
    margin-top: 4px;
    color: var(--red);
    font-size: 10px;
  }
  .rk-status {
    margin-top: 4px;
    color: var(--green);
    font-size: 11px;
  }

  .pvwrap {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg);
    box-shadow: 0 0 20px rgba(31, 122, 79, 0.16);
  }
  .pvframe {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
    border: 0;
    /* Read-only mirror — the GM controls from the real windows. */
    pointer-events: none;
  }
  .pvtag {
    position: absolute;
    top: 5px;
    right: 6px;
    font-size: 8px;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--gold);
    background: var(--menu-bg);
    padding: 1px 5px;
    border-radius: var(--r-pill);
    pointer-events: none;
  }
  .rk-caption {
    margin-top: 6px;
    font-size: 9.5px;
    letter-spacing: 0.04em;
    color: var(--faint);
    text-align: center;
  }

  /* Fit the Roller module into the narrow rail (its own window is untouched). */
  .rk-roll :global(.res) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    text-align: center;
    padding: 10px;
  }
  .rk-roll :global(.res .num) {
    min-width: 0;
    font-size: 30px;
  }
  .rk-roll :global(.res .air) {
    width: 100%;
  }
  .rk-roll :global(.tray) {
    grid-template-columns: repeat(4, 1fr);
  }
  .rk-roll :global(.seg button) {
    padding: 4px 9px;
    font-size: 11px;
  }

  .rk-keeper {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    flex-shrink: 0;
  }
</style>
