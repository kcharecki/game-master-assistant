<script lang="ts">
  import type { ModuleId } from '../lib/module';
  import { getModule } from '../lib/registry';

  let { moduleId }: { moduleId: ModuleId } = $props();
  const mod = $derived(getModule(moduleId));
</script>

<div class="editor-host">
  {#if mod.editor}
    {@const Editor = mod.editor}
    <Editor />
  {:else}
    <div class="noedit">No editor for <strong>{mod.title}</strong> yet.</div>
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
