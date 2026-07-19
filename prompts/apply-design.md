# Prompt — apply a design to a module

Copy the block below into a fresh session. Replace the CAPS placeholders.
One design → one module → one session (keeps context light).

---

Apply the **`DESIGN_NAME`** design to the **`MODULE_ID`** module and make it a faithful,
fully-functional match. Read `CLAUDE.md` first.

**Design source** (pick the one that applies):
- Local file: `@"PATH\TO\Design.html"` — usually a bundled/base64 page. Don't try to read it as
  text; copy it into the scratchpad, serve it with `python -m http.server`, open it in the preview
  browser, and read the real markup with `preview_eval(document.body.innerText)` +
  `preview_screenshot`. Scale a single mock frame with a CSS `transform` before screenshotting to see
  detail.
- Claude Design MCP (`DesignSync`): only works with an interactive `/design-login`, which this harness
  does NOT have. If it errors, ask me to download the `.dc.html` standalone and `@` it instead.

**Extract the spec** from the mock: every element, its "rehomed from v1" mapping if present, the token
colours, fonts, spacing, and interaction notes. Then read the current module in `src/modules/MODULE_ID/`
(`index.ts` manifest, `Desktop.svelte`, `Editor.svelte`, `store.svelte.ts`, `logic.ts`, `*.test.ts`) and
the i18n keys in `src/lib/i18n/messages/*.ts` (en + pl — keep both in parity).

**Implement**, honouring these project rules:
- **Prefix every component CSS class** with a module-unique token (e.g. `nb-`/`nbe-`). Generic names
  (`.cap .in .row .btn .card .chip .search .muted`) collide with global `app.css` and silently break
  layout. This is the #1 cause of "the rework looks broken".
- Use the design-system tokens in `src/app.css`: `--gold`, `--green`, `--serif`, `--txt`, `--muted`,
  `--faint`, `--line`/`--line2`, `--panel`/`--panel2`. Match the mock's accent colour and serif usage
  exactly — don't default to green if the mock is gold.
- Keep pure logic in `logic.ts` with co-located Vitest tests. Never import another module's internals;
  cross-module effects go through the store / bus (`putOnAir`, etc.).
- Add any new i18n keys to both `en` and `pl`.

**Verify visually — screenshots hang on Vite dev pages** (HMR socket never idles). Use the harness:
1. Point `src/preview/Preview.svelte` at this module with deterministic mock data (params `?c=…`).
2. `npm run build`
3. Start the `static` launch config (serves `dist/` on :8794).
4. `preview_screenshot` `http://localhost:8794/preview.html?c=…` and compare side-by-side to the mock.
5. Edit → repeat from step 2 until it matches.
Use `preview_eval` / `preview_inspect` for behaviour + exact computed styles (those work on dev too).

**Finish:** green gate (`npm run check · lint · test · build`), then show me before/after and wait — do
not commit unless I say so.

If the work is large, delegate independent parts (spec extraction, i18n, a sibling component) to
parallel subagents and only integrate their results on the main thread.

---
