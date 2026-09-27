// Contrôle qualité des fichiers livrés : durée, format, audio, textes, zones de
// sécurité. Écrit une planche contact et les calques de zones dans dist/qa/.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadTimeline } from './audio.mjs';
import { openScene } from './browser.mjs';
import { DIST, NAME, ffmpeg, probe } from './lib.mjs';

const QA = join(DIST, 'qa');
mkdirSync(QA, { recursive: true });
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`); ok &&= pass; };

for (const file of [`${NAME}.mp4`, `${NAME}-instagram-tiktok.mp4`]) {
  const path = join(DIST, file);
  if (!existsSync(path)) { check(file, false, 'absent : lancer npm run render'); continue; }
  const info = await probe(path);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = v.r_frame_rate.split('/').map(Number);
  console.log(`\n${file} (${(info.format.size / 1e6).toFixed(1)} Mo, ${(info.format.bit_rate / 1e6).toFixed(1)} Mb/s)`);
  check('Durée 30 s', Math.abs(Number(v.duration) - 30) < 0.034, `vidéo ${v.duration} s, conteneur ${info.format.duration} s`);
  check('Images', Number(v.nb_frames) === 900, `${v.nb_frames} images`);
  check('1080 × 1920 (9:16)', v.width === 1080 && v.height === 1920);
  check('30 i/s', num / den === 30);
  check('H.264 yuv420p', v.codec_name === 'h264' && v.pix_fmt === 'yuv420p', `${v.profile}, niveau ${v.level / 10}`);
  check('Audio AAC stéréo', a?.codec_name === 'aac' && a.channels === 2, a ? `${a.sample_rate} Hz` : 'pas d’audio');
  check('Audio 30 s', a && Math.abs(Number(a.duration) - 30) < 0.05, a?.duration);
}

// Loudness de la version sociale
const socialPath = join(DIST, `${NAME}-instagram-tiktok.mp4`);
if (existsSync(socialPath)) {
  const r = await ffmpeg(['-i', socialPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stderr: true });
  const I = Number(r.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
  const TP = Number(r.match(/Peak:\s+(-?[\d.]+) dBFS/g).pop().match(/-?[\d.]+/)[0]);
  check('Loudness ≈ -14 LUFS', Math.abs(I + 14) <= 1, `${I} LUFS, crête ${TP} dBTP`);
}

// Textes : orthographe de référence, adresse, prix révélé avant 15 s
const TL = loadTimeline();
const all = TL.texts.map((t) => t.text.replace(/<br>/g, ' ')).join(' | ');
console.log('\nTextes');
for (const must of ['TOUS LES MERCREDIS', 'TORTILLAS DE TACOS', 'BARRIO LATINO', '9 RUE DU PORT', '63000 CLERMONT-FERRAND', '3\u00A0€']) check(`Présent : « ${must} »`, all.includes(must));
const price = TL.texts.find((t) => t.id === 's3p');
check('Prix révélé avant 15 s', price.in < 15, `${price.in} s`);
const end = TL.texts.filter((t) => t.zone === 'end');
check('Écran final lisible ≥ 1,8 s complet', 30 - Math.max(...end.map((t) => t.in)) >= 1.8, `dernier élément à ${Math.max(...end.map((t) => t.in))} s`);

// Zones de sécurité : boîtes réelles des textes mesurées dans le navigateur
console.log('\nZones de sécurité (texte dans x 60–1020, y 220–1480, colonne d’icônes x > 970 dès y 980)');
const { browser, page } = await openScene({ safe: true });
const moments = [...new Set(TL.texts.map((t) => Math.min(29.9, (t.out ?? 30) - 0.1)))];
for (const tm of moments) {
  await page.evaluate((t) => window.renderFrame(t), tm);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.txt')].filter((e) => e.style.visibility !== 'hidden')
    .flatMap((e) => [...e.querySelectorAll('.inner')].map((n) => { const r = n.getBoundingClientRect(); return { text: n.textContent, l: r.left, r: r.right, t: r.top, b: r.bottom }; })));
  for (const b of boxes) {
    const inside = b.l >= 60 && b.r <= 1020 && b.t >= 220 && b.b <= 1480 && !(b.r > 970 && b.b > 980);
    if (!inside) check(`« ${b.text} » à ${tm.toFixed(1)} s`, false, `${b.l | 0}–${b.r | 0} × ${b.t | 0}–${b.b | 0}`);
  }
  await page.screenshot({ path: join(QA, `safe-${tm.toFixed(1)}s.png`) });
}
check('Tous les textes dans la zone utile', ok);
await browser.close();

const master = join(DIST, `${NAME}.mp4`);
if (existsSync(master)) {
  await ffmpeg(['-i', master, '-vf', 'fps=1,scale=216:384,tile=10x3:padding=4', '-frames:v', '1', join(QA, 'planche-contact.jpg')]);
  console.log(`\nPlanche contact et calques : ${QA}`);
}
console.log(ok ? '\nContrôle qualité : OK' : '\nContrôle qualité : ÉCHEC');
process.exit(ok ? 0 : 1);
