// Screenshot built components with Playwright's own headless Chromium.
//
// Why this exists: the in-app browser/MCP screenshot action times out in this
// environment on *every* page (even a trivial static one) — see CLAUDE.md. A
// headless Chromium driven by Node has no such problem. Use this to see real
// pixels of a component in isolation via the preview harness.
//
// Usage:
//   npm run build          # produce dist/ (required — this serves dist/)
//   npm run shot           # writes screenshots/*.png for the harness targets
//   node scripts/shot.mjs widget:440x520 editor:1100x720   # custom targets
//
// Each target is `<preview ?c= value>:<width>x<height>`. Output PNGs land in
// ./screenshots (gitignored). Point src/preview/Preview.svelte at the module
// you want to capture first.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const DIST = resolve('dist');
const OUT = resolve('screenshots');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
};

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : ['widget:440x520', 'editor:1100x720'])
  .map((t) => {
    const [c, size] = t.split(':');
    const [w, h] = (size ?? '440x520').split('x').map(Number);
    return { c, w, h };
  });

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = join(DIST, path === '/' ? 'index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
for (const { c, w, h } of targets) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:${port}/preview.html?c=${c}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const out = join(OUT, `${c}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log('wrote', out);
  await page.close();
}
await browser.close();
server.close();
