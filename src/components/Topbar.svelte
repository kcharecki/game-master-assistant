<script lang="ts">
  let { onOpenBroadcast }: { onOpenBroadcast: () => void } = $props();
</script>

<header class="topbar">
  <div class="brand">GM Assistant<small>CTHULHU EDITION</small></div>
  <span class="pill">The Haunting of Blackwater Creek</span>
  <span class="spacer"></span>
  <span class="pill">Session 02:34:17</span>
  <button class="btn" onclick={onOpenBroadcast}>Open Broadcast ↗</button>
</header>
