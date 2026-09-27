// Moteur de scène : window.renderFrame(t) place chaque élément pour l'instant t
// (en secondes). Aucun état entre deux images : le rendu est déterministe.
(() => {
  const TL = window.TIMELINE;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const PHOTO = params.get('photo') || '../.cache/hero-hd.png';
  const BLUR = params.get('blur') || '../.cache/hero-blur.jpg';
  if (params.has('safe')) document.body.classList.add('safe');

  // ---------- easing ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    linear: (p) => p,
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inCubic: (p) => p * p * p,
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    outBack: (p, s = 1.6) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
  };
  const prog = (t, a, b) => clamp((t - a) / (b - a));

  // Ressort amorti maîtrisé (pour le « 3 € ») : 0 → 1 avec un léger dépassement
  const spring = (p) => (p <= 0 ? 0 : 1 - Math.exp(-6.5 * p) * Math.cos(9 * p));

  // ---------- papel picado ----------
  const FLAG_COLORS = ['#C8321E', '#F2B33D', '#5E8C31', '#F6EDDC', '#B8643A'];
  const FLAGS = 11;
  const stringY = (x) => 132 + 30 * Math.sin((Math.PI * x) / 1080);
  function buildGarland() {
    const g = $('garland');
    let defs = '<defs>';
    let body = `<path d="M-20 ${stringY(-20)} ${Array.from({ length: 23 }, (_, i) => {
      const x = -20 + i * 50; return `L${x} ${stringY(x).toFixed(1)}`; }).join(' ')}" stroke="rgba(246,237,220,.55)" stroke-width="2.5" fill="none"/>`;
    for (let i = 0; i < FLAGS; i++) {
      const cx = 50 + i * 98;
      const w = 76, h = 92;
      // Découpes : losange central, cercles, petits triangles — motif papel picado
      defs += `<mask id="m${i}" maskUnits="userSpaceOnUse" x="${-w}" y="0" width="${2 * w}" height="${h + 10}">
        <path d="M${-w / 2} 0 H${w / 2} V${h - 12} ${Array.from({ length: 6 }, (_, k) => {
          const x1 = w / 2 - (k + 0.5) * (w / 6), x2 = w / 2 - (k + 1) * (w / 6);
          return `L${x1.toFixed(1)} ${h} L${x2.toFixed(1)} ${h - 12}`; }).join(' ')} Z" fill="#fff"/>
        <path d="M0 26 L13 44 L0 62 L-13 44 Z" fill="#000"/>
        <circle cx="-22" cy="20" r="5" fill="#000"/><circle cx="22" cy="20" r="5" fill="#000"/>
        <circle cx="-22" cy="68" r="5" fill="#000"/><circle cx="22" cy="68" r="5" fill="#000"/>
        <circle cx="0" cy="44" r="4" fill="#fff"/>
        <path d="M-30 44 l6 -6 l6 6 l-6 6 Z M30 44 l-6 -6 l-6 6 l6 6 Z" fill="#000"/>
      </mask>`;
      body += `<g id="flag${i}" data-cx="${cx}"><rect x="${-w / 2}" y="0" width="${w}" height="${h}" fill="${FLAG_COLORS[i % FLAG_COLORS.length]}" mask="url(#m${i})" opacity=".94"/></g>`;
    }
    g.innerHTML = defs + '</defs>' + `<g id="garlandBody">${body}</g>`;
  }

  // ---------- panneau crème à bord papel picado ----------
  function buildPanel() {
    const r = 20, n = Math.ceil(1080 / (2 * r)) + 1;
    let top = `M0 1400 V${r}`;
    for (let i = 0; i < n; i++) top += ` a${r} ${r} 0 0 1 ${2 * r} 0`;
    top += ' V1400 Z';
    let holes = '';
    for (let x = 20, k = 0; x < 1080; x += 40, k++) {
      holes += k % 2 === 0
        ? `<circle cx="${x}" cy="${r + 32}" r="5" fill="#000"/>`
        : `<path d="M${x} ${r + 24} l8 8 l-8 8 l-8 -8 Z" fill="#000"/>`;
    }
    $('panel').innerHTML = `
      <defs>
        <mask id="pm" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1400">
          <path d="${top}" fill="#fff"/>${holes}
        </mask>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F8F1E3"/><stop offset=".6" stop-color="#F4EAD6"/><stop offset="1" stop-color="#EFE2CA"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1080" height="1400" fill="url(#pg)" mask="url(#pm)"/>
      <rect x="0" y="${r + 58}" width="1080" height="3" fill="#F2B33D" opacity=".55"/>`;
  }

  // ---------- soleil (rayons) derrière le prix ----------
  function buildSun() {
    const n = 32, R = 600;
    let p = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI, a1 = a0 + Math.PI / n;
      p += `M540 540 L${(540 + R * Math.cos(a0)).toFixed(1)} ${(540 + R * Math.sin(a0)).toFixed(1)} L${(540 + R * Math.cos(a1)).toFixed(1)} ${(540 + R * Math.sin(a1)).toFixed(1)} Z `;
    }
    $('sun').innerHTML = `<defs><radialGradient id="sg"><stop offset=".12" stop-color="#F2B33D" stop-opacity=".30"/><stop offset="1" stop-color="#F2B33D" stop-opacity="0"/></radialGradient></defs><path d="${p}" fill="url(#sg)"/>`;
  }

  // ---------- grain ----------
  let grainTiles = [];
  function buildGrain() {
    // 4 tuiles de bruit pré-calculées, alternées : grain vivant mais déterministe
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas'); c.width = 540; c.height = 960;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(540, 960);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rnd() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0); grainTiles.push(c);
    }
    const g = $('grain'); g.style.width = '1080px'; g.style.height = '1920px';
  }

  // ---------- textes ----------
  const PIN = (color) => `<svg class="pin" viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z" fill="${color}"/><circle cx="12" cy="11.5" r="4.6" fill="rgba(0,0,0,.35)"/></svg>`;
  const MAXW = { lower: 840, price: 860, end: 820 };
  const texts = [];
  function buildTexts() {
    const root = $('texts');
    for (const d of TL.texts) {
      const el = document.createElement('div');
      el.className = `txt ${d.style}` + (/price|endPrice/i.test(d.style) ? ' noMask' : '');
      const lines = d.text.split('<br>');
      el.innerHTML = lines.map((l, i) => {
        const pin = d.pin && i === 0 ? PIN(d.zone === 'end' ? '#C8321E' : '#F2B33D') : '';
        return `<div class="line"><span class="mask"><span class="inner">${pin}${l}</span></span></div>`;
      }).join('');
      root.appendChild(el);
      texts.push({ d, el, inners: [...el.querySelectorAll('.inner')] });
    }
  }
  function fitTexts() {
    for (const { d, el, inners } of texts) {
      const max = MAXW[d.zone] || 840;
      const base = parseFloat(getComputedStyle(el).fontSize);
      let widest = Math.max(...inners.map((n) => n.getBoundingClientRect().width));
      if (widest > max) el.style.fontSize = `${Math.floor(base * (max / widest))}px`;
      // Centre vertical sur d.y
      const h = el.getBoundingClientRect().height;
      el.style.top = `${d.y - h / 2}px`;
      d._h = h;
    }
  }

  // ---------- caméra & fenêtres ----------
  function frameAt(t) {
    let f = { ...TL.frames.hero };
    for (const [a, b, from, to] of TL.frameMoves) {
      if (t >= b) f = { ...TL.frames[to] };
      else if (t > a) {
        const p = E.inOutCubic(prog(t, a, b)), A = TL.frames[from], B = TL.frames[to];
        f = { x: lerp(A.x, B.x, p), y: lerp(A.y, B.y, p), w: lerp(A.w, B.w, p), h: lerp(A.h, B.h, p) };
      }
    }
    return f;
  }
  function panelAt(t) {
    let y = 1920;
    for (const [a, b, y0, y1] of TL.panelMoves) {
      if (t >= b) y = y1; else if (t > a) y = lerp(y0, y1, E.inOutCubic(prog(t, a, b)));
    }
    return y;
  }
  function cameraAt(t) {
    const K = TL.camera;
    if (t <= K[0][0]) return { cx: K[0][1], cy: K[0][2], z: K[0][3] };
    for (let i = 1; i < K.length; i++) {
      if (t <= K[i][0]) {
        const a = K[i - 1], b = K[i];
        const p = (E[b[4] || 'inOutCubic'])(prog(t, a[0], b[0]));
        return { cx: lerp(a[1], b[1], p), cy: lerp(a[2], b[2], p), z: Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), p)) };
      }
    }
    const L = K[K.length - 1];
    return { cx: L[1], cy: L[2], z: L[3] };
  }

  let PW = 1, PH = 1;
  function placePhoto(f, cam) {
    const s = Math.max(f.w / PW, f.h / PH) * cam.z;
    const dw = PW * s, dh = PH * s;
    const left = clamp(f.w / 2 - cam.cx * dw, f.w - dw, 0);
    const top = clamp(f.h / 2 - cam.cy * dh, f.h - dh, 0);
    const ph = $('photo');
    ph.style.width = `${PW}px`; ph.style.height = `${PH}px`;
    ph.style.transform = `translate(${left}px, ${top}px) scale(${s})`;
  }

  // ---------- rendu d'une image ----------
  window.renderFrame = (t, frameIndex = Math.round(t * 30)) => {
    const f = frameAt(t), cam = cameraAt(t);
    const win = $('window');
    Object.assign(win.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    placePhoto(f, cam);

    // Fond flouté : parallax plus lent que la caméra
    $('blur').style.transform = `translate(${(-(cam.cx - 0.5) * 90).toFixed(2)}px, ${(-(cam.cy - 0.5) * 70).toFixed(2)}px) scale(${(1 + (cam.z - 1) * 0.12).toFixed(4)})`;

    // Panneau crème
    const py = panelAt(t);
    $('panel').style.transform = `translateY(${py}px)`;

    // Guirlande
    let gOpen = 0;
    for (const [a, b] of TL.garland) gOpen = Math.max(gOpen, t >= a && t < b + 0.6 ? Math.min(prog(t, a, a + 0.9), 1 - prog(t, b, b + 0.6)) : 0);
    for (let i = 0; i < FLAGS; i++) {
      const fl = $(`flag${i}`), cx = +fl.dataset.cx;
      let drop = 0;
      for (const [a, b] of TL.garland) {
        const pin = E.outBack(prog(t, a + i * 0.045, a + i * 0.045 + 0.75), 1.2);
        const pout = E.inCubic(prog(t, b + i * 0.02, b + i * 0.02 + 0.5));
        if (t >= a && t < b + 1) drop = Math.max(drop, pin - pout);
      }
      const sway = Math.sin(t * 2.1 + i * 0.75) * 3.2 + Math.sin(t * 3.7 + i * 1.3) * 1.2;
      fl.setAttribute('transform', `translate(${cx} ${(stringY(cx) - 6 - (1 - drop) * 190).toFixed(1)}) rotate(${sway.toFixed(2)}) scale(.8)`);
    }
    $('garland').style.opacity = gOpen > 0 ? 1 : 0;

    // Soleil derrière le prix
    const sunOp = Math.min(E.outCubic(prog(t, 9.55, 10.3)), 1 - prog(t, 14.7, 15.1));
    const sun = $('sun');
    sun.style.opacity = sunOp.toFixed(3);
    sun.style.transform = `translate(0px, ${(TL.texts.find((d) => d.id === 's3p').y - 540 + (py - 760)).toFixed(1)}px) rotate(${(t * 5).toFixed(2)}deg) scale(${lerp(0.7, 1, E.outCubic(prog(t, 9.55, 10.6))).toFixed(3)})`;

    // Onde d'impact du prix
    const impacts = [[9.6, 's3p'], [26.7, 'e2']];
    let ringOp = 0, ringR = 0, ringY = 0;
    for (const [ti, id] of impacts) {
      const p = prog(t, ti + 0.12, ti + 0.9);
      if (p > 0 && p < 1) { ringOp = (1 - p) * 0.4; ringR = lerp(170, 470, E.outCubic(p)); ringY = TL.texts.find((d) => d.id === id).y; }
    }
    const ring = $('ring');
    ring.style.opacity = ringOp.toFixed(3);
    ring.style.transform = `translateY(${ringY - 540}px)`;
    ring.firstElementChild.setAttribute('r', ringR.toFixed(1));

    // Pastille d'accroche « 3 € »
    const [ta, tb] = TL.teaser;
    const tin = E.outBack(prog(t, ta, ta + 0.5), 2.0), tout = E.inCubic(prog(t, tb, tb + 0.3));
    const ts = Math.max(0, tin - tout);
    const wob = Math.sin((t - ta) * 2.4) * 2;
    const tz = $('teaser');
    const fr = frameAt(t);
    tz.style.opacity = ts > 0.001 ? 1 : 0;
    tz.style.transform = `translate(${fr.x + 150 - 105}px, ${fr.y + fr.h - 30 - 105}px) rotate(${(-9 + wob).toFixed(2)}deg) scale(${ts.toFixed(4)})`;

    // Textes
    for (const { d, el, inners } of texts) {
      const out = d.out ?? 999;
      const visible = t >= d.in - 0.01 && t < out + 0.5;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) continue;
      const isPrice = /price|endPrice/i.test(d.style);
      inners.forEach((n, i) => {
        const a = d.in + i * 0.12;
        if (isPrice) {
          const p = prog(t, a, a + 1.1);
          const s = lerp(0.55, 1, spring(p));
          const po = 1 - prog(t, out, out + 0.35);
          n.style.transform = `scale(${(s * lerp(1, 0.9, 1 - po)).toFixed(4)})`;
          n.style.opacity = Math.min(prog(t, a, a + 0.12), po).toFixed(3);
          n.style.transformOrigin = '50% 60%';
        } else {
          const pin = E.outCubic(prog(t, a, a + 0.55));
          const pout = E.inCubic(prog(t, out + i * 0.05, out + i * 0.05 + 0.32));
          const y = (1 - pin) * 105 - pout * 105;
          n.style.transform = `translateY(${y.toFixed(2)}%)`;
          n.style.opacity = Math.min(prog(t, a, a + 0.25), 1 - pout).toFixed(3);
          n.style.letterSpacing = '';
        }
      });
    }

    // Grain
    const g = $('grain').getContext('2d');
    g.drawImage(grainTiles[frameIndex % grainTiles.length], 0, 0);
  };

  // ---------- initialisation ----------
  window.sceneReady = (async () => {
    const load = (img, src) => new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error(`Image introuvable : ${src}`)); img.src = src; });
    await Promise.all([load($('photo'), PHOTO), load($('blur'), BLUR)]);
    PW = $('photo').naturalWidth; PH = $('photo').naturalHeight;
    buildGarland(); buildPanel(); buildSun(); buildGrain(); buildTexts();
    await document.fonts.ready;
    // Force le chargement de tous les glyphes utilisés (emoji inclus)
    await Promise.all([
      document.fonts.load('800 100px "Baloo 2"', '3 € MERCREDI'),
      document.fonts.load('700 50px "Work Sans"', 'RUE'),
      document.fonts.load('600 50px "Work Sans"', 'RUE'),
      document.fonts.load('50px "Noto Color Emoji"', '🌮🌶️🇲🇽🌎'),
    ]);
    await document.fonts.ready;
    fitTexts();
    window.renderFrame(0);
    return { width: PW, height: PH };
  })();
})();
