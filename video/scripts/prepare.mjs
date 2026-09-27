// Prépare la photo héro : version agrandie proprement (Lanczos + accentuation
// légère) pour la fenêtre, et version très floutée pour le fond.
import { basename, join } from 'node:path';
import { CACHE, arg, ffmpeg, heroPhoto, probe } from './lib.mjs';

// Rognage de la photo par défaut : bande sombre à droite et objet coupé en haut.
// Pour une autre photo : --crop "x,y,w,h" en fractions (ex. "0,0.04,0.955,0.96").
const DEFAULT_CROP = { '04-tacos-mexicains-maison.jpg': [0, 0.04, 0.955, 0.96] };

export async function preparePhoto() {
  const src = heroPhoto();
  const cliCrop = arg('crop');
  const crop = typeof cliCrop === 'string' ? cliCrop.split(',').map(Number) : DEFAULT_CROP[basename(src)];
  const info = await probe(src);
  const st = info.streams.find((s) => s.codec_type === 'video');
  const [cx, cy, cw, ch] = crop || [0, 0, 1, 1];
  const width = Math.round(st.width * cw) & ~1, height = Math.round(st.height * ch) & ~1;
  const cropF = `crop=${width}:${height}:${Math.round(st.width * cx)}:${Math.round(st.height * cy)}`;
  // Cible ≥ 2600 px de large : la fenêtre zoomée ne ré-échantillonne jamais au-delà
  const factor = Math.max(1, Math.ceil(2600 / width));
  const hd = join(CACHE, 'hero-hd.png');
  const blur = join(CACHE, 'hero-blur.jpg');
  const sharpen = factor > 1 ? ',unsharp=5:5:0.55:5:5:0' : '';
  await ffmpeg(['-i', src, '-vf', `${cropF},scale=${width * factor}:${height * factor}:flags=lanczos${sharpen}`, hd]);
  await ffmpeg(['-i', src, '-vf', `${cropF},scale=270:480:force_original_aspect_ratio=increase,crop=270:480,gblur=sigma=14,scale=1080:1920:flags=bicubic,eq=saturation=1.15`, '-q:v', '3', blur]);
  return { src, width, height, factor, hd, blur };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await preparePhoto();
  console.log(`Photo héro : ${r.src} (${r.width}×${r.height}, agrandie ×${r.factor})`);
}
