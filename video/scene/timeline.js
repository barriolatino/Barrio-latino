// Timeline de la publicité « Mercredi tacos 3 € » — le seul fichier à modifier
// pour changer un texte, un timing ou un cadrage.
//
// Coordonnées caméra : (cx, cy) = point de la photo placé au centre de la
// fenêtre, en fraction de la photo (0,0 = haut gauche, 1,1 = bas droite).
// zoom = 1 : la photo remplit exactement la fenêtre (mode « cover »).
//
// Les cadrages ci-dessous correspondent à assets/04-tacos-mexicains-maison.jpg :
//   bol de salsa rouge  ≈ (0.30, 0.20)     taco gauche + oignons ≈ (0.22, 0.58)
//   taco central        ≈ (0.55, 0.45)     tortilla droite       ≈ (0.80, 0.30)
//   guacamole           ≈ (0.75, 0.80)
// En changeant de photo héro, repérer ces éléments et mettre à jour CAMERA.

window.TIMELINE = {
  duration: 30,

  // Fenêtres photo (x, y, w, h en px sur 1080 × 1920)
  frames: {
    hero:  { x: 48, y: 170, w: 984, h: 930 },   // scènes 1, 2, 4, 5
    price: { x: 48, y: 170, w: 984, h: 620 },   // scène 3
    final: { x: 60, y: 186, w: 960, h: 600 },   // scène 6 (ratio 1,6 = photo entière)
  },

  // Changements de fenêtre : [début, fin, de, vers]
  frameMoves: [
    [9.0, 9.6, 'hero', 'price'],
    [15.0, 15.6, 'price', 'hero'],
    [26.1, 26.7, 'hero', 'final'],
  ],

  // Panneau crème (bord papel picado) : [début, fin, y de, y vers]
  panelMoves: [
    [9.0, 9.6, 1920, 760],
    [15.0, 15.55, 760, 1920],
    [26.1, 26.7, 1920, 740],
  ],

  // Caméra : [temps, cx, cy, zoom, easing vers ce point]
  camera: [
    [0.0,  0.50, 0.55, 1.00],
    [4.0,  0.50, 0.55, 1.08, 'linear'],       // S1 slow push-in
    [4.7,  0.27, 0.58, 1.45, 'inOutCubic'],   // S2 approche taco + oignons
    [9.0,  0.40, 0.52, 1.55, 'inOutSine'],    //    glisse vers la garniture
    [9.6,  0.52, 0.50, 1.15, 'inOutCubic'],   // S3 fenêtre prix
    [15.0, 0.56, 0.50, 1.22, 'linear'],
    [15.6, 0.22, 0.42, 1.30, 'inOutCubic'],   // S4 panoramique salsa → guacamole
    [19.95, 0.74, 0.60, 1.30, 'inOutSine'],
    [20.4, 0.74, 0.78, 1.60, 'outExpo'],      // S5 guacamole (coupes calées sur 2 temps)
    [21.3, 0.74, 0.78, 1.66, 'linear'],
    [21.6, 0.30, 0.22, 1.60, 'outExpo'],      //    salsa
    [22.5, 0.31, 0.22, 1.66, 'linear'],
    [22.8, 0.20, 0.60, 1.55, 'outExpo'],      //    oignons rouges
    [23.7, 0.21, 0.60, 1.61, 'linear'],
    [24.0, 0.56, 0.45, 1.55, 'outExpo'],      //    taco central
    [24.9, 0.57, 0.45, 1.61, 'linear'],
    [25.2, 0.80, 0.32, 1.50, 'outExpo'],      //    tortilla droite
    [26.1, 0.81, 0.32, 1.55, 'linear'],
    [26.7, 0.50, 0.50, 1.00, 'inOutCubic'],   // S6 composition complète
    [30.0, 0.50, 0.50, 1.045, 'linear'],      //    dernier zoom très léger
  ],

  // Guirlande papel picado : [apparition, disparition]
  garland: [[0.15, 4.2], [26.55, 31]],

  // Pastille « 3 € » d'accroche (scènes 1-2) avant la révélation
  teaser: [2.4, 9.0],

  // Textes. y = centre vertical de la ligne (px). zone : 'lower' = sous la
  // fenêtre (fond sombre), 'price' = panneau crème scène 3, 'end' = écran final.
  // Zone utile Reels/TikTok : y 220 → 1480, x 110 → 970 (voir docs).
  // [in, out] en secondes ; out absent = jusqu'à la fin de la zone.
  texts: [
    // Scène 1
    { id: 's1a', zone: 'lower', y: 1205, in: 0.25, out: 3.9, style: 'h1', text: '🌮 MERCREDI ?' },
    { id: 's1b', zone: 'lower', y: 1318, in: 1.35, out: 3.9, style: 'h2', text: 'ON MANGE TACOS.' },
    // Scène 2
    { id: 's2a', zone: 'lower', y: 1205, in: 4.35, out: 8.9, style: 'h1', text: 'UNE ENVIE DE TACOS ?' },
    { id: 's2b', zone: 'lower', y: 1318, in: 6.3,  out: 8.9, style: 'h2', text: 'ON A CE QU’IL TE FAUT 🌮' },
    // Scène 3 — révélation du prix
    { id: 's3p', zone: 'price', y: 1045, in: 9.6, out: 14.95, style: 'price', text: '3 €' },
    { id: 's3a', zone: 'price', y: 1300, in: 10.8, out: 14.95, style: 'l2', text: 'TOUS LES MERCREDIS' },
    { id: 's3b', zone: 'price', y: 1392, in: 12.0, out: 14.95, style: 'l3', text: 'TORTILLAS DE TACOS' },
    // Scène 4
    { id: 's4a', zone: 'lower', y: 1162, in: 15.55, out: 19.85, style: 'kicker', text: 'CHEZ' },
    { id: 's4b', zone: 'lower', y: 1242, in: 15.7,  out: 19.85, style: 'h1', text: 'BARRIO LATINO 🇲🇽🌎' },
    { id: 's4c', zone: 'lower', y: 1378, in: 17.0,  out: 19.85, style: 'body', text: 'UNE PAUSE LATINO<br>À CLERMONT-FERRAND' },
    // Scène 5
    { id: 's5a', zone: 'lower', y: 1195, in: 20.4, out: 26.0, style: 'h1', text: 'RENDEZ-VOUS MERCREDI 🌮' },
    { id: 's5b', zone: 'lower', y: 1310, in: 21.9,  out: 26.0, style: 'addr', text: '9 RUE DU PORT', pin: true },
    { id: 's5c', zone: 'lower', y: 1392, in: 23.1, out: 26.0, style: 'city', text: 'CLERMONT-FERRAND' },
    // Scène 6 — écran final (reste affiché jusqu'à 30 s)
    { id: 'e1', zone: 'end', y: 852, in: 26.55, style: 'endKicker', text: '🌮 MERCREDI TACOS 🌮' },
    { id: 'e2', zone: 'end', y: 1030, in: 26.7, style: 'endPrice', text: '3 €' },
    { id: 'e3', zone: 'end', y: 1198, in: 27.3,  style: 'endBrand', text: 'BARRIO LATINO' },
    { id: 'e4', zone: 'end', y: 1310, in: 27.6,  style: 'endAddr', text: '9 RUE DU PORT<br>63000 CLERMONT-FERRAND', pin: true },
    { id: 'e5', zone: 'end', y: 1432, in: 28.2,  style: 'endCta', text: 'Viens goûter 🌶️' },
  ],

  // Repères son (utilisés par scripts/audio.mjs)
  sfx: {
    whoosh: [3.95, 14.95, 19.95, 21.3, 22.5, 23.7, 24.9, 26.1],
    riser:  [7.2, 9.6],
    impact: [9.6, 26.7],
    tick:   [0.25, 1.35, 10.8, 12.0, 21.9, 23.1, 27.3, 27.6],
  },
};
