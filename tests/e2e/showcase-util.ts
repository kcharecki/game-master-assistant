import type { Page } from '@playwright/test';

/**
 * Shared helpers for the *showcase* specs (demo-video recordings, not gates):
 * a visible fake cursor with click ripples, an on-screen caption banner, and a
 * paced `beat`. Playwright's synthetic mouse fires real DOM mouse events, so the
 * injected cursor tracks every locator.click()/hover().
 */

/** Inject a visible cursor + click ripple. Call BEFORE page.goto(). */
export async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const start = () => {
      if (document.getElementById('__cursor')) return;

      const style = document.createElement('style');
      style.textContent = `
        #__cursor{position:fixed;left:-40px;top:-40px;z-index:2147483647;width:22px;height:22px;
          margin:-11px 0 0 -11px;border-radius:50%;pointer-events:none;
          background:radial-gradient(circle at 35% 32%, #fff 0%, #ffe9a8 40%, #d6b65e 70%, rgba(214,182,94,0) 72%);
          box-shadow:0 0 10px 3px rgba(214,182,94,.55);transition:transform .1s ease;transform:translate(0,0) scale(1);}
        .__cursor_rip{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;
          border-radius:50%;pointer-events:none;border:2px solid #d6b65e;animation:__rip .55s ease-out forwards;}
        @keyframes __rip{from{transform:scale(.4);opacity:.9}to{transform:scale(3.2);opacity:0}}
      `;
      document.documentElement.appendChild(style);

      const dot = document.createElement('div');
      dot.id = '__cursor';
      document.body.appendChild(dot);

      const move = (x: number, y: number) => {
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
      };
      addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true);
      addEventListener(
        'mousedown',
        (e) => {
          dot.style.transform = 'scale(0.7)';
          const r = document.createElement('div');
          r.className = '__cursor_rip';
          r.style.left = `${e.clientX}px`;
          r.style.top = `${e.clientY}px`;
          document.body.appendChild(r);
          setTimeout(() => r.remove(), 600);
        },
        true,
      );
      addEventListener('mouseup', () => (dot.style.transform = 'scale(1)'), true);
    };
    if (document.body) start();
    else addEventListener('DOMContentLoaded', start);
  });
}

/** Show/replace the on-screen caption banner and hold briefly. */
export async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    let el = document.getElementById('__showcase_caption');
    if (!el) {
      el = document.createElement('div');
      el.id = '__showcase_caption';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:26px',
        'transform:translateX(-50%)',
        'z-index:2147483646',
        'padding:10px 20px',
        'border-radius:10px',
        'background:rgba(9,16,13,0.92)',
        'border:1px solid #4fa37b',
        'color:#e9e2c9',
        'font:600 16px/1.4 Georgia,serif',
        'letter-spacing:0.02em',
        'box-shadow:0 8px 30px rgba(0,0,0,0.6)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(700);
}

export const beat = (page: Page, ms = 900): Promise<void> => page.waitForTimeout(ms);
