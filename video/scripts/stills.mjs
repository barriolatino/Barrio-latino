// Aperçus fixes pour relecture : `node scripts/stills.mjs 1.5 12 29.5 [--safe]`
// → .cache/stills/t-<temps>.png (avec --safe : calque des zones d'interface).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openScene } from './browser.mjs';
import { CACHE, arg } from './lib.mjs';
import { preparePhoto } from './prepare.mjs';

const times = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
const safe = arg('safe', false) === true;
const dir = join(CACHE, 'stills');
mkdirSync(dir, { recursive: true });
await preparePhoto();
const { browser, page } = await openScene({ safe });
for (const t of times.length ? times : [1, 3, 6, 8, 10.5, 13, 17.5, 21, 24.5, 29.5]) {
  await page.evaluate((t) => window.renderFrame(t), t);
  const file = join(dir, `t-${t.toFixed(2)}${safe ? '-safe' : ''}.png`);
  await page.locator('#stage').screenshot({ path: file });
  console.log(file);
}
await browser.close();
