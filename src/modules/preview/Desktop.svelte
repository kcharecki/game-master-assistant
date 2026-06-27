<script lang="ts">
  // A silent, scaled-down mirror of the screen-shared broadcast page. Uses the
  // real broadcast renderer (?preview=1 → visuals only, no audio) so it always
  // matches exactly what players see, including grids, maps, mood and YT video.
  const SRCW = 1280;
  const SRCH = 800;

  let w = $state(0);
  const scale = $derived(w > 0 ? w / SRCW : 0);
</script>

<div class="pvwrap" bind:clientWidth={w} style="aspect-ratio:{SRCW}/{SRCH}">
  <iframe
    class="pvframe"
    title="Broadcast preview"
    src="broadcast.html?preview=1"
    style="width:{SRCW}px;height:{SRCH}px;transform:scale({scale})"
  ></iframe>
  <span class="pvtag">● LIVE</span>
</div>

<style>
  .pvwrap {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid var(--line2);
    background: #05090a;
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
    top: 6px;
    right: 8px;
    font-size: 9px;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: #ff6b6b;
    background: rgba(9, 16, 13, 0.7);
    padding: 1px 6px;
    border-radius: 999px;
    pointer-events: none;
  }
</style>
