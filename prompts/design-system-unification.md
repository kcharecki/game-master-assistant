# Brief — Unified Design System + Wireframe for the GM Assistant

You have this repository linked. **Read the real implementation** — `src/app.css` (the token
layer), the shipped modules under `src/modules/*` (their `Desktop.svelte` / `Editor.svelte`),
the surfaces in `src/surfaces/*`, and the player `src/broadcast/Broadcast.svelte`. Use the
code to learn the current visual language, the tokens already in play, and every component
that exists.

**Critical framing: the current implementation is your REFERENCE, not your TARGET.** It grew
component-by-component, so styling drifted — buttons, dropdowns, inputs, menus, chips, tabs,
cards, toggles and popovers are subtly inconsistent across modules (padding, radii, border
colors, hover states, focus rings, font usage, label casing, icon sizing). Your job is to
**define the improved, unified version** these components *should* converge to. Where a
current component is clumsy, redesign it to be better. Do not merely document what's there.

## The product (context)

A single-user "desktop OS" a Game Master uses to run online tabletop RPG sessions. Dark
"Command Deck / séance" theme: near-black greens, a gold accent reserved for "on air," a
display serif for titles/headers, a sans body. Three surfaces (draggable desktop windows /
editor tabs / a screen-shared player broadcast). GM-only tool — no player accounts.
Minimalism and dead-simple setup are core values; the UI should feel like a calm, fast,
serious cockpit, never busy or consumer-playful.

## Goal

Produce the **base design system** that all future components build on — comprehensive,
internally consistent, and obsessive about the small details. Alongside it, a **wireframe /
showcase** that demonstrates every element and several real stage layouts. It does not need
to be a working app; light interactivity only where it communicates the design (hover
states, button press/active, toggle flips, dropdown open/close, focus rings, tab switches).

## Scope — unify and elevate every shared element

Go through the codebase and reconcile these into one coherent set (redesign freely where it
improves clarity or simplicity):

- **Foundations:** color roles (surface levels, lines/borders, text/muted/faint, green
  family, gold "on air", red/danger, focus), spacing scale, radii, elevation/shadow, border
  treatments, the density scale (comfortable / default / compact), motion/timing, and
  focus-visible rings. Confirm or improve the existing token set; name every token and its
  intent. Ensure text roles pass contrast on the dark background.
- **Typography:** the display-serif vs sans split — when each is used, the type scale
  (window titles, section headers, body, labels, captions, numeric/tabular), weights,
  letter-spacing, and label casing rules (e.g. the small uppercase tracked labels).
- **Buttons:** the full family — primary, secondary/ghost, icon button, danger, the gold
  "on air" state, toggle/segmented, disabled. All states: rest, hover, active/pressed,
  focus-visible, on/selected, disabled. Sizes tied to the density scale.
- **Inputs & forms:** text input, textarea, number, select, search field, file-picker
  button, inline-edit field, sliders/range, checkbox/radio/switch. Rest / focus / filled /
  error / disabled. Label + field + help/validation layout.
- **Menus, dropdowns & popovers:** the dropdown menu, menu headers/items/selected/disabled,
  the floating action bar, the anchored edit popover, tooltips, and toasts (incl. the
  undoable toast). Consistent shadow, border, radius, item padding, hover.
- **Containers:** window chrome (title strip, traffic-light dots), panels/cards, editor
  tabs and scene tabs, section headers, drawers/rails, chips (source chips, reference
  chips), tables/lists, empty states, dividers.
- **Feedback & status:** the "on air" gold treatment, live/recording indicators, badges,
  the panic action, loading/idle states, hidden/withheld treatment (e.g. hatched overlay).
- **Iconography:** sizing, stroke weight, alignment, and the small glyph set in use.

## The stage showcase (broadcast dimension)

Because the broadcast/stage is central, the showcase must include the **player-facing render
language** and several composed layouts, so the system is proven end-to-end:

- The content kinds shown on air: text card (with parchment / letter / telegram skins),
  image (with caption + a reveal treatment), NPC card, countdown clock, in-world
  date/moon, dice-result card, and a multi-tile grid layout.
- The framing layers: mood/lighting washes, cinematic vs plain display mode, scene
  crossfade.
- At least 3–4 **different stage compositions** (e.g. a single dramatic image; a letter
  handout; a split NPC-portrait + text; a countdown + date HUD) so the grid, spacing, and
  typography are shown under real content.
- The GM authoring board should be shown as the truthful live preview of that player view.

## Constraints

- Keep it dark, atmospheric, minimal. Gold stays reserved for on-air/live meaning — never
  decorative.
- Respect the three density modes; components must hold up at compact size.
- Accessibility: visible focus, adequate contrast, `prefers-reduced-motion` friendliness,
  real hit-target sizes.
- Stay implementable with the existing token architecture (CSS custom properties); if you
  propose new tokens, name them and give values. Don't invent a framework — this maps back
  to Svelte components + `app.css`.
- Preserve the existing content capabilities (all the stage kinds, mood, display mode,
  laser/ping, reveal animations) — you're unifying their *look*, not removing features.

## Deliverables

1. **Design-system sheet:** the full token layer (color/type/space/radius/elevation/motion)
   and every component above rendered in all its states, laid out like a proper component
   library / style guide, with the naming and usage rules spelled out.
2. **Wireframe / showcase:** the components composed into real screens — a GM desktop window
   or two, an editor tab, the floating action bar + edit popover in context, and the stage
   showcase with several player-broadcast compositions.
3. **Notes on what you changed and why** — call out each place you improved on the current
   implementation, and any new tokens/patterns you introduced, so this can guide the
   refactor of every existing component toward it.

Attention to the small details is the whole point: consistent padding rhythm, aligned
optical spacing, matched border/hover/focus treatments across every control, coherent label
casing, and a type scale that feels deliberate. Make this the dependable base everything else
inherits from.
