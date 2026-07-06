---
description: Generate a paste-ready Claude Design prompt to rework a component/module
argument-hint: <module-id or path> [extra direction]
allowed-tools: Read, Glob, Grep, Bash
---

# /prompt-redesign

Produce a **paste-ready prompt for Claude Design** (Anthropic's prompt-to-prototype tool) that
reworks the component the user points at. Output is a prompt the user copies into Claude Design —
NOT an implementation. Do not edit any source files.

Target: **$ARGUMENTS** (a `src/modules/<id>/` module id, or a direct path to a `.svelte` file).

## What Claude Design is (so you scope the prompt right)

Claude Design (Anthropic Labs, launched Apr 2026) turns a natural-language prompt into an interactive
HTML/CSS/JS prototype, refined via chat, inline comments, direct edits, and on-the-fly sliders. It can
read a codebase for brand consistency and accept image uploads / web-capture of the current UI. It
outputs **mockups and prototypes**, not wired-into-repo code.

So the prompt you write should be **visual + product framing**, and must OMIT engineering ceremony that
Claude Design ignores: no test gates, no i18n parity, no CSS-class-prefix rule, no module contract, no
Vitest, no green-gate. Those belong to `/apply-design` (the downstream step that builds the chosen mock
into the real module). Keep those two roles separate.

## Steps

1. **Resolve the target.** If `$ARGUMENTS` is a module id, read `src/modules/<id>/index.ts` (manifest:
   title, default `size`) + `Desktop.svelte` (and `Editor.svelte` if relevant). If it's a path, read
   that file. Read `logic.ts` / `store.svelte.ts` too — **surface capabilities that already exist in
   logic but are missing from the UI**; those are usually the highest-value redesign wins.
2. **Skim the theme tokens** in `src/app.css` (`--green`, `--txt`, `--muted`, `--faint`, `--line2`,
   `--serif`, `--gold`, `--panel`…) so the prompt names the real palette this app uses.
3. **Emit the prompt** in the template below, filled from what you read. Then stop — ask if the user
   wants a real before-screenshot captured (build → static serve on :8794 → `preview_screenshot`) to
   upload alongside the prompt.

## App facts to bake into every prompt

- Virtual GM (Game Master) desktop OS for running tabletop RPG sessions online (D&D, Call of Cthulhu).
  GM-only tool, used live mid-session — speed + glanceability win.
- Aesthetic: dark "séance / occult command deck". Near-black bg, séance-green accent
  (`#2f8a66`, brighter `#6fd0a0`), hairline borders, serif (`--serif`) for flavor. Some v2 modules use
  gold (`--gold`) instead — match whatever the target already uses.
- Components are small draggable/resizable desktop windows (some also have a full Editor tab). State
  the default window `size` from the manifest and that it must stay usable at min size.
- Tell Claude Design to **read the codebase** for brand tokens so the mock slots into the real product.

## Prompt template (fill and output verbatim to the user)

> # Claude Design prompt: Rework "<TITLE>"
>
> **What it is:** <one line — the component's job inside the GM app, and that it's a compact
> live-play desktop window, default ~<W>×<H>, pinned/used mid-session>.
>
> **Aesthetic direction:** dark séance / occult command-deck. <accent + serif notes>. Compact, dense,
> AA-legible on dark. Read my codebase (`src/app.css` tokens: <list>) so it matches the real product.
>
> **Current version is <the user's complaint / "ugly + shallow">.** Today it only does: <bullet the
> present behavior from Desktop.svelte>.
>
> **Redesign it. Surface what a GM actually needs:**
> - <feature bullets — lead with capabilities already in logic.ts that the UI never exposes>
> - <keep-these bullets — existing behavior worth preserving>
>
> **Constraints:** fits a small resizable window (~<W>×<H>, can grow); usable at min size; clear zones.
>
> **Deliver** a clickable prototype + 1–2 layout variants (dense vs. roomy), with sliders for density
> and accent intensity.
>
> <any [extra direction] the user passed in $ARGUMENTS>

If the target is unclear or not found, list the module ids under `src/modules/` and ask which one.
