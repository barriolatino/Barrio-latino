// Chemins et utilitaires partagés par les scripts de rendu.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = resolve(ROOT, '..');
export const CACHE = join(ROOT, '.cache');
export const DIST = join(ROOT, 'dist');
export const SOURCE = join(ROOT, 'source');
export const FFMPEG = ffmpegPath;
export const FFPROBE = ffprobeStatic.path;

export const W = 1080, H = 1920, FPS = 30, DURATION = 30;
export const NAME = 'barrio-latino-mercredi-tacos-3-euros';

for (const d of [CACHE, DIST]) mkdirSync(d, { recursive: true });

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

// Photo héro : --photo <chemin>, sinon video/source/hero.*, sinon la photo tacos du site
export function heroPhoto() {
  const cli = arg('photo');
  if (typeof cli === 'string') return resolve(process.cwd(), cli);
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const p = join(SOURCE, `hero.${ext}`);
    if (existsSync(p)) return p;
  }
  return join(REPO, 'assets', '04-tacos-mexicains-maison.jpg');
}

export function run(cmd, args, { input, quiet = true, stderr = false } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => { err += d; if (!quiet) process.stderr.write(d); });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res(stderr ? err : out) : rej(new Error(`${cmd} ${args.join(' ')}\n${err.slice(-3000)}`))));
    if (input) input(p.stdin);
  });
}

export const ffmpeg = (args, opts) => run(FFMPEG, ['-hide_banner', '-y', ...args], opts);

export async function probe(file) {
  const out = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(out);
}
