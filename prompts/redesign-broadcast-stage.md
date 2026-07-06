# Redesign brief — Broadcast Stage + Broadcast (player view)

You are redesigning **one feature of a Game Master's "desktop OS"** for running online
tabletop RPG sessions (D&D, Call of Cthulhu, etc.). You have full creative freedom over the
UX and visual design of this feature. Go wild — but respect the hard constraints below.

## The product in one paragraph

A single Game Master runs an online session alone. Players have **no accounts and no devices
in the app** — they see the game **only** by the GM screen-sharing exactly **one broadcast
window**. So there is one shareable "stage," and modules take turns being the thing shown on
it: images, letters, maps, NPC portraits, countdowns, dice results. Everything else on the
GM's screen is private. The GM composes what goes on that stage.

## What exists today (the thing you're replacing)

**Broadcast Stage** (GM side): a WYSIWYG board that *is* a live preview of the player
window. It's locked to a 1280×800 broadcast aspect and a 12×8 grid. The GM drops **tiles**
onto it:

- **image** (with caption; optional reveal treatment: blur→sharp, or slow crop-pan)
- **text** (title + body; skins: parchment scroll / typed letter / telegram slip)
- **npc** (pulls a *player-safe* projection of a roster NPC — portrait or name/role only)
- **clock** (a live countdown)
- **date** (in-world date / time-of-day / moon phase snapshot)

Tiles are drag-moved and corner-resized on the grid, hidden/shown, layered, duplicated.
Content comes in via a menu, OS file drop, clipboard paste, or dragging NPCs from a side
drawer. The board supports **scenes** (named tabs — you pre-build one board per moment) and
**presets** (content-free layouts reused across campaigns).

To broadcast, the GM has an "On Air" cluster:

- **To Air** — push the current scene to the player window.
- **Live** — every edit re-broadcasts instantly.
- **Spotlight** — blow one tile up fullscreen, cinematically.
- **Panic** — instantly clear the player window.
- **Laser** — the GM's cursor over the board drives a live red pointer dot on the shared view.
- **Mood** — a color/lighting wash over the player view (Neutral / Dread / Hearth / Cold /
  Blood: tint + brightness + vignette).
- **Display mode** — Cinematic (film grain, vignette pulse, letterbox bars) vs Plain (flat,
  legible).

**Broadcast** (player side): a separate screen-shared page. It renders whatever's on air —
text card, image, battle map (fog of war + tokens), the stage grid mirrored cell-for-cell,
a big dice-result card — with a mood wash and display-mode framing layered on top, and a
soft crossfade between scenes.

## Why it needs a redesign — the real problems

1. **Setup is slow and manual.** The GM builds each scene tile-by-tile. Prepping a session
   means hand-authoring many near-identical boards. There's no fast pre-session flow.
2. **Branching isn't modeled.** Real sessions fork constantly: *"if the players go left / if
   they talk to the baron / if they attack / if they fail the roll."* Today the GM pre-makes
   separate scene tabs and hopes they remember which is which, mid-session, under pressure.
3. **No variants.** The same beat often needs small variants (day vs night version of a
   location; the NPC calm vs the NPC hostile; map before vs after the reveal). Today that's
   full duplicate scenes.
4. **No run-cursor / live navigation.** During play the GM needs to move through a planned
   flow *fast* and adjust on the fly, not hunt through tabs.

## Your job

Redesign **Broadcast Stage (the GM authoring + live-control surface)** and, where it
matters, **how the player broadcast presents**. Optimize hard for three things, in order:

1. **Dead-simple to set up.** A GM should assemble a session's visuals with the least
   possible friction. Reduce clicks, reuse aggressively, make good defaults.
2. **Fast to plan before a session.** Sketching the intended flow — including forks and
   variants — should feel quick and visual, not like data entry.
3. **Effortless to run and adjust live.** During the game the GM is improvising. Airing the
   next thing, jumping to a branch the players triggered, or tweaking a scene on the spot
   must be near-instant and low-cognitive-load. Panic-clear must always be one action away.

**Explicitly design for:**

- **Branching situations** — a first-class way to express "if players do X → show this; if
  Y → show that," and to *follow* the branch they actually take, live. Think about how the
  GM sees the map of possibilities and jumps around it without losing their place.
- **Multiple scenes / a session flow** — an ordered, navigable sequence of stage states,
  with a clear "where am I now / what's next / what are the side-branches" model.
- **Variants** — lightweight alternates of a scene or tile (day/night, calm/hostile,
  before/after) that don't require rebuilding the whole board.

Feel free to rethink the tile grid, the scene/tab model, the on-air controls, the
pre-session vs live distinction (maybe they're different modes?), and the relationship
between planning a flow and running it. You may propose new primitives.

## Hard constraints (do not break these)

- **One broadcast window.** No per-player views, no player devices, no messaging. The player
  side shows one thing at a time. Whatever you design for the GM must resolve to a single
  shared view.
- **Player-safety.** Anything player-facing must never leak GM-private data (secret HP,
  GM notes, hidden tiles, unrevealed branches). Hidden/prep content stays GM-eyes-only.
- **The board is a truthful preview.** The GM must always be able to see exactly what
  players currently see, and what they're *about* to see, before airing it.
- **Panic clear** stays instant and always reachable.
- **Live control must survive pressure** — big targets, minimal reading, no deep menus for
  the actions used every few minutes during play.
- Keep the existing content kinds working (image / text+skins / npc / clock / date / map /
  dice), plus mood wash, cinematic-vs-plain display, laser pointer, reveal animations.

## Aesthetic

Existing look is a dark "séance / command-deck" theme: near-black greens, a gold accent for
"on air," serif display type for atmosphere. You may evolve it, but keep it atmospheric and
GM-tool-serious, not consumer-playful. The player broadcast should feel cinematic; the GM
control surface should feel like a calm, fast cockpit.

## Deliverables

- A clear concept for the redesigned GM authoring + live-run surface, and how branching,
  scene flow, and variants are represented and navigated.
- Visual mockups of: (a) the pre-session planning/authoring view, (b) the live-run control
  view, (c) at least one branching/variant moment, and (d) the resulting player broadcast.
- Call out the core interactions for the three priorities (setup, plan, run-live) and how a
  GM moves between planning and running.
- Note any new concepts you introduce and how they map back to "one shared window."
