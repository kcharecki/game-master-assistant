<script lang="ts">
  import type { ModuleId } from '../lib/module';
  let { moduleId, title }: { moduleId: ModuleId; title: string } = $props();
</script>

<p class="muted" style="font-size:13px">
  <strong style="color:var(--green)">{title}</strong> — module stub. Build its desktop view in
  <code>src/modules/{moduleId}/</code>.
</p>
