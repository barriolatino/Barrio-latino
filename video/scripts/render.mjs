// Rendu complet : photo → bande son → 900 images → MP4 master, version réseaux
// sociaux et miniature.
//   npm run render                 rendu final (≈ 5 min)
//   npm run render -- --preview    brouillon rapide 15 i/s, sans version sociale
//   npm run render -- --photo chemin/vers/photo.jpg [--crop x,y,w,h]
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildAudio } from './audio.mjs';
import { openScene } from './browser.mjs';
import { DIST, DURATION, FPS, NAME, arg, ffmpeg } from './lib.mjs';
import { preparePhoto } from './prepare.mjs';

const preview = arg('preview', false) === true;
const fps = preview ? 15 : FPS;
const frames = Math.round(DURATION * fps);
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s] ${m}`);

const photo = await preparePhoto();
log(`Photo héro : ${photo.src} (${photo.width}×${photo.height})`);
const audio = await buildAudio();
log(`Bande son prête${audio.voiceover ? ' avec voix off' : ' (musique + effets, sans voix off)'}`);

const master = join(DIST, preview ? `${NAME}-preview.mp4` : `${NAME}.mp4`);
const social = join(DIST, `${NAME}-instagram-tiktok.mp4`);
const cover = join(DIST, 'barrio-latino-mercredi-tacos-cover.jpg');
const toBt709 = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
const tags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// Plusieurs Chromium en parallèle ; les images sont écrites dans l'ordre.
const WORKERS = Math.max(1, Math.min(3, (await import('node:os')).cpus().length - 1));
const scenes = await Promise.all(Array.from({ length: WORKERS }, () => openScene()));
for (const s of scenes) s.cdp = await s.page.context().newCDPSession(s.page);
const { page } = scenes[0];
const chains = scenes.map(() => Promise.resolve());
const frameAt = (i) => {
  const w = scenes[i % WORKERS];
  const job = chains[i % WORKERS].then(async () => {
    await w.page.evaluate(([t, i]) => window.renderFrame(t, i), [i / fps, i]);
    const r = await w.cdp.send('Page.captureScreenshot', {
      format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 },
    });
    return Buffer.from(r.data, 'base64');
  });
  chains[i % WORKERS] = job.catch(() => {});
  return job;
};
const encode = ffmpeg([
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-i', audio.file,
  '-map', '0:v', '-map', '1:a',
  '-vf', toBt709,
  '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', preview ? '24' : '15',
  '-profile:v', 'high', '-level:v', '4.2', '-g', String(fps), '-bf', '2',
  ...tags,
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
  '-t', String(DURATION), '-movflags', '+faststart', master,
], {
  input: async (stdin) => {
    const pending = [];
    for (let i = 0; i < Math.min(frames, WORKERS * 2); i++) pending.push(frameAt(i));
    for (let i = 0; i < frames; i++) {
      const png = await pending.shift();
      if (i + WORKERS * 2 < frames) pending.push(frameAt(i + WORKERS * 2));
      if (!stdin.write(png)) await new Promise((r) => stdin.once('drain', r));
      if (i % (fps * 3) === 0) log(`image ${i}/${frames}  (t = ${(i / fps).toFixed(1)} s)`);
    }
    stdin.end();
  },
});
await encode;
log(`Master : ${master}`);

if (!preview) {
  // Miniature : écran final (toutes les infos, lisible en grille 4:5 et 3:4)
  await page.evaluate(() => window.renderFrame(29.5, 885));
  const png = join(DIST, '.cover.png');
  await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await ffmpeg(['-i', png, '-q:v', '2', cover]);
  rmSync(png);
  log(`Miniature : ${cover}`);

  // Version Instagram Reels / TikTok / Stories : H.264 High 4.1, débit plafonné
  // (≈ 8 Mb/s), GOP 1 s, AAC 48 kHz 192 kb/s, -14 LUFS, faststart.
  await ffmpeg([
    '-i', master,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '8M', '-bufsize', '16M',
    '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p', '-g', String(FPS), '-keyint_min', String(FPS), '-sc_threshold', '0',
    ...tags,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-t', String(DURATION), social,
  ]);
  log(`Version réseaux sociaux : ${social}`);
}
await Promise.all(scenes.map((s) => s.browser.close()));
log('Terminé. Contrôle qualité : npm run check');
