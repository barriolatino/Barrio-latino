// Bande son originale synthétisée (aucun sample, aucun droit à gérer) :
// groove latino contemporain à 100 BPM en la mineur (i–VI–III–VII),
// guitare nylon (Karplus-Strong), basse tumbao, dembow léger, marimba,
// plus les effets calés sur scene/timeline.js (whoosh, montée, impact).
//
// Sortie : .cache/music.wav, puis .cache/soundtrack.wav (normalisé à -14 LUFS,
// avec la voix off de video/source/voiceover.wav mixée par-dessus si présente).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { CACHE, DURATION, ROOT, SOURCE, ffmpeg } from './lib.mjs';

export function loadTimeline() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'scene', 'timeline.js'), 'utf8'), ctx);
  return ctx.window.TIMELINE;
}

const SR = 48000;
const BPM = 100;
const S16 = 60 / BPM / 4;            // double-croche = 0,15 s
const BAR = S16 * 16;                // mesure = 2,4 s
const N = Math.round(SR * DURATION);

// ---------- utilitaires ----------
let seed = 20240925;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const bus = () => [new Float32Array(N), new Float32Array(N)];
const buses = { drums: bus(), keys: bus(), bass: bus(), fx: bus(), send: bus() };

function add(b, t0, samples, gain = 1, pan = 0, send = 0) {
  const start = Math.round(t0 * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const k = start + i;
    if (k < 0 || k >= N) continue;
    b[0][k] += samples[i] * gl; b[1][k] += samples[i] * gr;
    if (send) { buses.send[0][k] += samples[i] * gl * send; buses.send[1][k] += samples[i] * gr * send; }
  }
}
function biquad(x, type, f, q = 0.707) {
  // Filtre biquad (RBJ) à fréquence éventuellement variable : f nombre ou fonction(i)
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof f === 'function' ? f(i) : f;
    const w = (2 * Math.PI * fc) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const noise = (dur) => Float32Array.from({ length: Math.round(dur * SR) }, rnd);

// ---------- instruments ----------
function kick() {
  const n = Math.round(0.45 * SR), o = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 48 + 110 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t / 0.22) + (i < 60 ? rnd() * 0.25 * (1 - i / 60) : 0);
  }
  return o;
}
function snare() {
  const nz = biquad(noise(0.22), 'bp', 2200, 0.8);
  const n = nz.length, o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = nz[i] * 1.6 * Math.exp(-t / 0.07) + Math.sin(2 * Math.PI * 185 * t) * 0.5 * Math.exp(-t / 0.05); }
  return o;
}
function clap() {
  const nz = biquad(noise(0.3), 'bp', 1400, 0.9), o = new Float32Array(nz.length);
  for (let i = 0; i < nz.length; i++) {
    const t = i / SR;
    const env = [0, 0.011, 0.022].reduce((a, d) => a + (t >= d ? Math.exp(-(t - d) / (d === 0.022 ? 0.09 : 0.008)) : 0), 0);
    o[i] = nz[i] * env * 1.4;
  }
  return o;
}
function hat(open = false) {
  const nz = biquad(noise(open ? 0.3 : 0.06), 'hp', 7500, 0.7), o = new Float32Array(nz.length);
  for (let i = 0; i < nz.length; i++) o[i] = nz[i] * Math.exp(-(i / SR) / (open ? 0.12 : 0.018));
  return o;
}
function shaker() {
  const nz = biquad(noise(0.09), 'bp', 6000, 1.2), o = new Float32Array(nz.length);
  for (let i = 0; i < nz.length; i++) { const t = i / SR; o[i] = nz[i] * Math.min(1, t / 0.012) * Math.exp(-t / 0.03); }
  return o;
}
function conga(f) {
  const n = Math.round(0.3 * SR), o = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += (2 * Math.PI * f * (1 + 0.12 * Math.exp(-t / 0.02))) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t / 0.12) + (i < 200 ? rnd() * 0.3 * (1 - i / 200) : 0);
  }
  return o;
}
function pluck(f, dur = 1.2, bright = 0.5) {
  // Karplus-Strong : corde de guitare nylon
  const n = Math.round(dur * SR), L = Math.max(2, Math.round(SR / f)), buf = new Float32Array(L), o = new Float32Array(n);
  for (let i = 0; i < L; i++) buf[i] = rnd() * (0.6 + 0.4 * bright);
  let lp = 0;
  for (let i = 0; i < L; i++) { lp = lp + (buf[i] - lp) * (0.25 + bright * 0.5); buf[i] = lp; }
  for (let i = 0; i < n; i++) {
    const k = i % L, nx = (k + 1) % L;
    const v = 0.4985 * (buf[k] + buf[nx]);
    o[i] = buf[k]; buf[k] = v;
  }
  for (let i = 0; i < n; i++) o[i] *= Math.min(1, (n - i) / (0.05 * SR));
  return o;
}
function marimba(f) {
  const n = Math.round(0.9 * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    o[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.32)
          + 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t / 0.05)
          + 0.12 * Math.sin(2 * Math.PI * f * 9.8 * t) * Math.exp(-t / 0.015)) * Math.min(1, t / 0.002);
  }
  return o;
}
function bassNote(f, dur) {
  const n = Math.round((dur + 0.08) * SR), o = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / 0.006) * (t < dur ? Math.exp(-t / 0.9) : Math.exp(-dur / 0.9) * Math.max(0, 1 - (t - dur) / 0.08));
    o[i] = Math.tanh((Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * 1.4) * env;
  }
  return o;
}
function pad(freqs, dur) {
  const n = Math.round(dur * SR), o = new Float32Array(n);
  for (const f of freqs) for (const det of [-0.12, 0.12]) {
    let ph = rnd() * Math.PI;
    for (let i = 0; i < n; i++) { ph += (2 * Math.PI * f * Math.pow(2, det / 12)) / SR; o[i] += (2 / Math.PI) * Math.asin(Math.sin(ph)) * 0.12; }
  }
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] *= Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.3); }
  return biquad(o, 'lp', 1800);
}
function whoosh(dur = 0.45) {
  const n = Math.round(dur * SR);
  const f = (i) => 350 * Math.pow(12, Math.sin((Math.PI * i) / n / 2));
  const nz = biquad(noise(dur), 'bp', f, 1.4), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i / n; o[i] = nz[i] * Math.sin(Math.PI * Math.pow(p, 0.7)) * 1.6; }
  return o;
}
function riser(dur) {
  const n = Math.round(dur * SR);
  const f = (i) => 300 * Math.pow(20, i / n);
  const nz = biquad(noise(dur), 'bp', f, 2), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i / n; o[i] = nz[i] * Math.pow(p, 2.2) * 0.9; }
  return o;
}
function impact() {
  const n = Math.round(1.4 * SR), o = new Float32Array(n);
  const nz = biquad(noise(1.4), 'lp', 900);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += (2 * Math.PI * (38 + 50 * Math.exp(-t / 0.08))) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t / 0.45) * 0.9 + nz[i] * Math.exp(-t / 0.12) * 0.8;
  }
  return o;
}
function tick() {
  const n = Math.round(0.03 * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / 0.006); }
  return o;
}

// ---------- réverbération (Schroeder) ----------
function reverb([L, R]) {
  const combs = [1557, 1617, 1491, 1422], aps = [225, 556];
  const proc = (x, spread) => {
    const out = new Float32Array(x.length);
    for (const c of combs) {
      const d = c + spread, buf = new Float32Array(d); let k = 0, lp = 0;
      for (let i = 0; i < x.length; i++) {
        const y = buf[k]; lp = y * 0.6 + lp * 0.4; buf[k] = x[i] + lp * 0.78; k = (k + 1) % d; out[i] += y * 0.25;
      }
    }
    for (const a of aps) {
      const d = a + spread, buf = new Float32Array(d); let k = 0;
      for (let i = 0; i < x.length; i++) { const b = buf[k]; const y = -out[i] + b; buf[k] = out[i] + b * 0.5; k = (k + 1) % d; out[i] = y; }
    }
    return out;
  };
  return [proc(L, 0), proc(R, 23)];
}

// ---------- composition ----------
export async function buildAudio() {
  const TL = loadTimeline();
  const at = (bar, s16 = 0) => bar * BAR + s16 * S16;
  const bars = Math.ceil(DURATION / BAR);
  // i – VI – III – VII en la mineur
  const chords = [
    { root: 45, tones: [57, 60, 64] },   // Am
    { root: 41, tones: [53, 57, 60] },   // F
    { root: 48, tones: [55, 60, 64] },   // C
    { root: 43, tones: [55, 59, 62] },   // G
  ];
  const kickTimes = [];
  const drop = (t) => (t >= 9.0 && t < 9.6) || t >= 29.4; // silence avant l'impact et fin
  const K = kick(), SN = snare(), CL = clap(), HC = hat(), HO = hat(true), SH = shaker();

  for (let b = 0; b < bars; b++) {
    const ch = chords[b % 4], next = chords[(b + 1) % 4];
    for (let s = 0; s < 16; s++) {
      const t = at(b, s);
      if (t >= DURATION) break;
      const full = t >= 0, energy = t >= 19.8 && t < 26.7;
      // Shaker : double-croches, accent sur les contretemps
      if (t < 29.4) add(buses.drums, t, SH, s % 2 ? 0.26 : 0.14, 0.35);
      if (drop(t)) continue;
      // Dembow : grosse caisse sur les temps, caisse claire en 3-3-2
      if (full && s % 4 === 0) { add(buses.drums, t, K, t < 4.8 ? 0.38 : 0.5); kickTimes.push(t); }
      if (t >= 4.8 && [3, 6, 11, 14].includes(s)) add(buses.drums, t, SN, 0.3, -0.05, 0.08);
      if (full && t < 4.8 && [4, 12].includes(s)) add(buses.drums, t, CL, 0.3, 0, 0.2);
      if (energy && s % 2 === 1) add(buses.drums, t, HC, 0.22, -0.3);
      if (energy && s === 14) add(buses.drums, t, HO, 0.16, -0.3);
      // Congas sur les contretemps (couleur latine)
      if (t >= 4.8 && [2, 7, 10, 15].includes(s)) add(buses.drums, t, conga(s === 7 || s === 15 ? 262 : 330), 0.24, 0.4, 0.05);
      // Basse tumbao (entre à 9,6 s sur l'impact)
      if (t >= 9.6) {
        if (s === 0) add(buses.bass, t, bassNote(midi(ch.root), 0.5), 0.5);
        if (s === 6) add(buses.bass, t, bassNote(midi(ch.root), 0.25), 0.42);
        if (s === 10) add(buses.bass, t, bassNote(midi(ch.root + 7), 0.2), 0.38);
        if (s === 14) add(buses.bass, t, bassNote(midi(next.root), 0.2), 0.4);
      }
    }
    // Guitare nylon : arpège syncopé
    const pat = [[0, 0], [2, 1], [3, 2], [5, 1], [6, 0], [8, 2], [10, 1], [11, 0], [13, 2], [14, 1]];
    for (const [s, k] of pat) {
      const t = at(b, s);
      if (t >= 29.4 || (t > 9.1 && t < 9.6)) continue;
      const f = midi(ch.tones[k] + (s >= 8 && k === 2 ? 12 : 0));
      add(buses.keys, t, pluck(f, 1.0, s % 4 === 0 ? 0.7 : 0.45), s % 4 === 0 ? 0.55 : 0.4, k === 0 ? -0.4 : 0.35, 0.18);
    }
    // Nappe douce
    const t0 = at(b);
    if (t0 < 29) add(buses.keys, t0, pad(ch.tones.map((m) => midi(m - 12)), Math.min(BAR, 29.4 - t0)), 0.2, 0, 0.3);
  }
  // Marimba : motif pentatonique en scène 3 puis montée d'énergie (scène 5)
  const motif = [[0, 76], [3, 79], [6, 81], [8, 79], [10, 76], [12, 74], [14, 72]];
  for (const [startBar, endT] of [[4, 14.9], [8, 26.6]]) {
    for (let b = startBar; at(b) < endT; b++) {
      for (const [s, m] of motif) {
        const t = at(b, s); if (t >= endT) break;
        if (startBar === 4 && b % 2 === 1 && s > 8) continue;
        add(buses.keys, t, marimba(midi(m)), 0.22, 0.25, 0.25);
      }
    }
  }
  // Accord final
  for (const [i, m] of [57, 60, 64, 69].entries()) add(buses.keys, 28.8 + i * 0.015, pluck(midi(m), 1.2, 0.7), 0.3, i % 2 ? 0.3 : -0.3, 0.35);
  add(buses.bass, 28.8, bassNote(midi(45), 0.6), 0.45);
  add(buses.drums, 28.8, K, 0.55); kickTimes.push(28.8);

  // Effets calés sur la timeline
  for (const t of TL.sfx.whoosh) add(buses.fx, t - 0.2, whoosh(), 0.22, 0, 0.2);
  if (TL.sfx.riser) add(buses.fx, TL.sfx.riser[0], riser(TL.sfx.riser[1] - TL.sfx.riser[0]), 0.28, 0, 0.1);
  for (const t of TL.sfx.impact) add(buses.fx, t, impact(), 0.55, 0, 0.35);
  for (const t of TL.sfx.tick) add(buses.fx, t, tick(), 0.06, 0.2);

  // ---------- mix ----------
  // Pompage léger (sidechain) de la basse et des claviers sur la grosse caisse
  const duck = new Float32Array(N).fill(1);
  for (const tk of kickTimes) {
    const s0 = Math.round(tk * SR);
    for (let i = 0; i < 0.3 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.35 * Math.exp(-i / SR / 0.09));
  }
  const rev = reverb(buses.send);
  const out = [new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 2; c++) {
    const bassLp = biquad(buses.bass[c], 'lp', 1200);
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const fade = Math.min(1, t / 0.02) * Math.min(1, (DURATION - t) / 0.5);
      const v = buses.drums[c][i] * 0.9 + (buses.keys[c][i] * 0.85 + bassLp[i] * 0.9) * duck[i] + buses.fx[c][i] + rev[c][i] * 0.35;
      out[c][i] = Math.tanh(v * 0.9) * fade;
    }
  }
  let peak = 0;
  for (const ch of out) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const g = 0.89 / peak;
  const pcm = Buffer.alloc(44 + N * 4);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[c][i] * g)) * 32767), 44 + i * 4 + c * 2);
  const music = join(CACHE, 'music.wav');
  writeFileSync(music, pcm);

  // Voix off optionnelle : la musique s'efface sous la voix (sidechain)
  const vo = ['wav', 'mp3', 'm4a'].map((e) => join(SOURCE, `voiceover.${e}`)).find(existsSync);
  const mixed = join(CACHE, 'mix.wav');
  if (vo) {
    await ffmpeg(['-i', music, '-i', vo, '-filter_complex',
      '[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,asplit=2[vo][sc];[0:a]volume=0.8[m];[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[duck];[duck][vo]amix=inputs=2:duration=first:normalize=0[a]',
      '-map', '[a]', '-t', String(DURATION), mixed]);
  } else {
    await ffmpeg(['-i', music, '-t', String(DURATION), mixed]);
  }
  // Normalisation -14 LUFS (standard Instagram/TikTok), 2 passes
  const measure = await ffmpeg(['-i', mixed, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { stderr: true });
  const stats = JSON.parse(measure.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const out2 = join(CACHE, 'soundtrack.wav');
  await ffmpeg(['-i', mixed, '-af',
    `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`,
    '-ar', '48000', out2]);
  return { file: out2, voiceover: vo || null, loudness: stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await buildAudio();
  console.log(`Bande son : ${r.file}${r.voiceover ? ` (voix off : ${r.voiceover})` : ' (sans voix off)'} — mesuré ${r.loudness.input_i} LUFS avant normalisation`);
}
