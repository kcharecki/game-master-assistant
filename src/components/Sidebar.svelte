<script lang="ts">
  import KeeperEye from './KeeperEye.svelte';
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
</script>

<aside class="sidebar">
  <nav class="nav">
    <a
      class:active={activeView === 'desktop'}
      href="#desktop"
      onclick={(e) => {
        e.preventDefault();
        onShowDesktop();
      }}>{t('sidebar.desktop')}</a
    >
    {#each editable as m (m.id)}
      <a
        class:active={activeView === m.id}
        href="#{m.id}"
        onclick={(e) => {
          e.preventDefault();
          onOpenEditor(m.id);
        }}>{t('mod.' + m.id + '.title')}</a
      >
    {/each}
  </nav>

  <div class="backup">
    <div class="bhead">{t('sidebar.campaign')}</div>
    <div class="brow">
      <button class="bbtn" onclick={doExport}>{t('sidebar.export')}</button>
      <button class="bbtn" onclick={() => fileInput?.click()}>{t('sidebar.import')}</button>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json"
      class="hidden"
      onchange={onImportFile}
    />
    <button class="quota" onclick={refreshQuota}>
      {#if quota}
        {t('sidebar.storagePre')}{fmtBytes(quota.usage)}{t('sidebar.storageSep')}{fmtBytes(quota.quota)}
        {#if quota.nearLimit}<span class="warn">{t('sidebar.nearLimit')}</span>{/if}
      {:else}
        {t('sidebar.checkStorage')}
      {/if}
    </button>
    {#if status}<div class="bstatus">{status}</div>{/if}
  </div>

  <KeeperEye />
</aside>

<style>
  .backup {
    margin-top: auto;
    padding: 10px 4px 8px;
    border-top: 1px solid var(--line);
  }
  .bhead {
    color: var(--faint);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .brow {
    display: flex;
    gap: 6px;
  }
  .bbtn {
    flex: 1;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--txt);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .bbtn:hover {
    border-color: var(--green-dim);
    color: var(--green);
  }
  .hidden {
    display: none;
  }
  .quota {
    width: 100%;
    margin-top: 6px;
    padding: 4px 6px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 11px;
  }
  .quota:hover {
    color: var(--txt);
  }
  .warn {
    color: var(--red);
  }
  .bstatus {
    margin-top: 4px;
    color: var(--green);
    font-size: 11px;
  }
</style>
