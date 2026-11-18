// Génère les icônes PNG (iPhone 180 px, Android 192/512 px) à partir du dessin vectoriel.
// Usage : node outils/icones.cjs
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const t of [180, 192, 512]) {
    // Icône pleine page (sans coins arrondis : iOS et Android les arrondissent eux-mêmes).
    await p.setViewportSize({ width: t, height: t });
    await p.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${t}" height="${t}" style="display:block"><rect width="48" height="48" fill="#1B2230"/><g transform="translate(4.8 4.8) scale(.8)"><rect x="9" y="22" width="14" height="16" rx="2.5" fill="#B0432A"/><rect x="25" y="22" width="14" height="16" rx="2.5" fill="#1D6A50"/><rect x="17" y="9" width="14" height="11" rx="2.5" fill="#F6F3EE"/></g></svg></body></html>`);
    await p.screenshot({ path: path.join(__dirname, "../public/icons", `icone-${t}.png`) });
  }
  await b.close();
})();
