<script lang="ts">
  import KeeperEye from './KeeperEye.svelte';
  import { moduleList } from '../lib/registry';
  import type { ModuleId } from '../lib/module';

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
</script>

<aside class="sidebar">
  <nav class="nav">
    <a
      class:active={activeView === 'desktop'}
      href="#desktop"
      onclick={(e) => {
        e.preventDefault();
        onShowDesktop();
      }}>Desktop</a
    >
    {#each editable as m (m.id)}
      <a
        class:active={activeView === m.id}
        href="#{m.id}"
        onclick={(e) => {
          e.preventDefault();
          onOpenEditor(m.id);
        }}>{m.title}</a
      >
    {/each}
  </nav>
  <KeeperEye />
</aside>
