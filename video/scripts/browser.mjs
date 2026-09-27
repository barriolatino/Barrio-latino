// Ouvre la scène HTML dans Chromium headless à 1080 × 1920.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT, W, H } from './lib.mjs';

export async function openScene({ safe = false } = {}) {
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const url = pathToFileURL(join(ROOT, 'scene', 'index.html'));
  if (safe) url.search = 'safe';
  await page.goto(url.href);
  await page.evaluate(() => window.sceneReady);
  if (errors.length) throw new Error(`Erreurs dans la scène :\n${errors.join('\n')}`);
  return { browser, page };
}
