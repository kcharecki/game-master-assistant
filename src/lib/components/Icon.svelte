<script lang="ts" module>
  // One consistent stroke-based line-icon set. Paths are drawn in a 24×24 box
  // and inherit `currentColor` so they match surrounding text. Add new glyphs
  // here rather than reaching for emoji.
  export type IconName =
    | 'edit'
    | 'trash'
    | 'prev'
    | 'next'
    | 'plus'
    | 'close'
    | 'pin'
    | 'play'
    | 'pause'
    | 'stop'
    | 'search'
    | 'air'
    | 'export'
    | 'tile'
    | 'chevron'
    | 'open'
    | 'density'
    | 'undo'
    | 'redo'
    | 'grid'
    | 'laser'
    | 'moon'
    | 'fork'
    | 'duplicate'
    | 'eye-off'
    | 'spotlight'
    | 'message'
    | 'shuffle'
    | 'attach';

  const PATHS: Record<IconName, string> = {
    edit: 'M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z M14 6l3 3',
    trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
    prev: 'M18 5v14 M8 12l8-7v14z',
    next: 'M6 5v14 M16 12L8 5v14z',
    plus: 'M12 5v14 M5 12h14',
    close: 'M6 6l12 12 M18 6L6 18',
    pin: 'M12 2v7 M8 9h8l-1.5 6h-5L8 9z M12 15v7',
    play: 'M8 5v14l11-7z',
    pause: 'M9 5v14 M15 5v14',
    stop: 'M6 6h12v12H6z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
    air: 'M12 4a8 8 0 0 0 0 16 M12 20a8 8 0 0 0 0-16 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    export: 'M12 3v12 M8 11l4 4 4-4 M4 19h16',
    tile: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    chevron: 'M6 9l6 6 6-6',
    open: 'M14 4h6v6 M20 4l-9 9 M19 14v5H5V5h5',
    density: 'M4 6h16 M4 12h16 M4 18h16',
    undo: 'M3 12h12a4 4 0 0 1 0 8h-3 M7 8l-4 4 4 4',
    redo: 'M21 12H9a4 4 0 0 0 0 8h3 M17 8l4 4-4 4',
    grid: 'M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18',
    laser: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    fork: 'M7 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M7 8v8 M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M17 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 8a5 5 0 0 1-5 5H7',
    duplicate: 'M8 8h12v12H8z M16 8V4H4v12h4',
    'eye-off': 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z M4 4l16 16',
    spotlight: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 21a7 7 0 0 1 14 0',
    message: 'M4 5h16v11H9l-4 4V5z',
    shuffle: 'M17 4l3 3-3 3 M3 7h4l10 10h4 M17 20l3-3-3-3 M3 17h4l3-3',
    attach: 'M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.5a2 2 0 0 1-2.9-2.9L15 6',
  };
</script>

<script lang="ts">
  let {
    name,
    size = 16,
    stroke = 1.8,
    class: klass = '',
  }: { name: IconName; size?: number; stroke?: number; class?: string } = $props();
</script>

<svg
  class={klass}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
    flex: 0 0 auto;
  }
</style>
