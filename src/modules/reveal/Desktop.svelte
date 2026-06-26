<script lang="ts">
  import { clearBroadcast } from './bus-actions';
</script>

<p class="muted" style="font-size:13px; margin-bottom:12px">
  Compose what players see in the <strong style="color:var(--green)">Reveal</strong> editor tab, then
  push it on air. This widget controls the live broadcast.
</p>
<button class="btn" onclick={clearBroadcast}>Clear Broadcast</button>
