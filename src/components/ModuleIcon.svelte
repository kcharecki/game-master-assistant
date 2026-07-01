<!-- Hand-drawn occult line-icons, one per module. Stroke inherits currentColor
     so the icon tints with the surrounding text (and its hover state). Cohesive
     séance style: thin lines, watching eyes, moons, sigils, tentacles. -->
<script lang="ts">
  import type { ModuleId } from '../lib/module';

  let { id, size = 20 }: { id: ModuleId; size?: number } = $props();

  // Inner SVG markup per module. Kept as static, trusted strings (no user data),
  // so {@html} is safe here.
  const glyphs: Partial<Record<ModuleId, string>> = {
    // Crossed blades — turn order / combat.
    initiative: '<path d="M4 5l13 13"/><path d="M20 5L7 18"/><circle cx="4.5" cy="4.5" r="1"/><circle cx="19.5" cy="4.5" r="1"/><path d="M15 18l2 2 2-1M9 18l-2 2-2-1"/>',
    // Cracked skull face — sanity.
    sanity: '<circle cx="12" cy="11" r="8"/><path d="M12 3v4"/><circle cx="9" cy="11" r="1.4"/><circle cx="15" cy="11" r="1.4"/><path d="M10 17l1-1 1 1 1-1 1 1"/>',
    // Crescent moon + spark — in-world calendar / moon phases.
    calendar: '<path d="M18 13a6.5 6.5 0 1 1-7-8 5 5 0 0 0 7 8z"/><path d="M6 4l.7 1.6L8.3 6.3 6.7 7 6 8.6 5.3 7 3.7 6.3 5.3 5.6z"/>',
    // Open tome — lore wiki.
    lore: '<path d="M12 6C9 4 5 4 3 5v13c2-1 6-1 9 1 3-2 7-2 9-1V5c-2-1-6-1-9 1z"/><path d="M12 6v13"/>',
    // Hooded cultist — NPCs.
    npcs: '<path d="M12 3c-4 0-6 4-6 10 0 0 2-2 6-2s6 2 6 2c0-6-2-10-6-10z"/><path d="M9 11c.3 2.5 1.5 4 3 4s2.7-1.5 3-4"/>',
    // Timeline — beaded thread of events.
    schedule: '<path d="M3 12h18"/><circle cx="6.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17.5" cy="12" r="1.6"/><path d="M12 6.5v3.5M17.5 14v3.5"/>',
    // Folded map with an X — battle map.
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><path d="M11 9.5l2.5 2.5M13.5 9.5L11 12"/>',
    // Monitor with a play glyph — broadcast preview.
    preview: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M9 21h6M12 17v4"/><path d="M11 9l3.5 2-3.5 2z"/>',
    // Portal arch with a watching eye — broadcast stage.
    stage: '<path d="M5 20V11a7 7 0 0 1 14 0v9"/><path d="M4 20h16"/><path d="M9 11q3-3 6 0-3 3-6 0z"/><circle cx="12" cy="11" r="1"/>',
    // Wax-sealed letter — handouts.
    handouts: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3.5 7l8.5 6 8.5-6"/><circle cx="12" cy="14.5" r="2.3"/>',
    // Eye between parted curtains — reveal window.
    reveal: '<path d="M4 3v18M20 3v18"/><path d="M4 3c3 1.5 3 8 0 9M20 3c-3 1.5-3 8 0 9"/><path d="M8 15q4-4 8 0-4 4-8 0z"/><circle cx="12" cy="15" r="1.3"/>',
    // Speaker with sound arcs — audio.
    audio: '<path d="M4 10v4h3l4 3V7l-4 3z"/><path d="M15 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10"/>',
    // d20 die — roller.
    roller: '<path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z"/><path d="M12 3l7.5 13.7h-15z"/><path d="M12 12v9M4.5 7.3L12 12l7.5-4.7"/>',
    // Closed grimoire with a pentacle — rules reference.
    rules: '<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M9 3v18"/><path d="M14.2 7.4l1 2.4 2.6.2-2 1.7.7 2.5-2.3-1.4-2.3 1.4.6-2.5-2-1.7 2.6-.2z"/>',
    // Quill writing on a line — session notes.
    notebook: '<path d="M4 20c5-1.5 8-4.5 15-15"/><path d="M14 5l4 4"/><path d="M4 20l3.5-1"/><path d="M4 15h6"/>',
    // Hourglass with falling sand — session timer.
    timer: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/><path d="M12 12v4"/>',
  };

  // Generic sigil for anything unmapped: an eye in a warding circle.
  const fallback = '<circle cx="12" cy="12" r="9"/><path d="M6 12q6-6 12 0-6 6-12 0z"/><circle cx="12" cy="12" r="2"/>';
  const markup = $derived(glyphs[id] ?? fallback);
</script>

<svg
  class="micon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted icon paths; no user input -->
  {@html markup}
</svg>

<style>
  .micon {
    display: block;
    /* A faint séance glow ties the set together. */
    filter: drop-shadow(0 0 3px rgba(70, 232, 154, 0.25));
  }
</style>
