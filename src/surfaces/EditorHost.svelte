<script lang="ts">
  import type { ModuleId } from '../lib/module';
  import { getModule } from '../lib/registry';
  import { t } from '../lib/i18n';

  let { moduleId }: { moduleId: ModuleId } = $props();
  const mod = $derived(getModule(moduleId));
</script>

<div class="editor-host">
  {#if mod.editor}
    {@const Editor = mod.editor}
    <Editor />
  {:else}
    <div class="noedit">{t('editorHost.noEditorPre')}<strong>{t('mod.' + moduleId + '.title')}</strong>{t('editorHost.noEditorPost')}</div>
  {/if}
</div>

<style>
  .editor-host {
    flex: 1;
    min-width: 0;
    overflow: auto;
    background: var(--bg);
  }
  .noedit {
    padding: 44px;
    color: var(--muted);
  }
</style>
