/* ===========================================================================
   COCKTAILS BY CLEM — comportements
   Aucune dépendance. Tout dégrade proprement sans JavaScript.
   1 données · 2 rendu · 3 en-tête · 4 menu · 5 révélations · 6 parallaxe
   7 services · 8 formulaire · 9 carte Google · 10 divers
   ========================================================================= */
(() => {
  'use strict';

  const WHATSAPP = '33763920998';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Les états masqués ne s'appliquent qu'une fois le JS en route : sans lui,
  // la page reste entièrement lisible.
  root.classList.add('js');

  /* --- 1. Données ------------------------------------------------------- */

  // Descriptions reprises telles quelles du brief. Rien n'est ajouté sur
  // l'expérience, les diplômes ou les références : ces faits ne sont pas connus.
  const SERVICES = [
    { id: 'barman',     titre: 'Barman privé',
      type: 'Événement sur mesure',
      texte: "Un barman professionnel directement sur votre événement.",
      detail: "Le bar s'installe sur place : matériel, verrerie, préparation et service. Vous n'avez rien à gérer pendant la soirée.",
      img: 'assets/dosage-alcool.jpg',
      alt: "Clem dose l'alcool au jigger au-dessus du blender, pendant le service." },
    { id: 'mariage',    titre: 'Mariages',
      type: 'Mariage',
      texte: "Une animation cocktail élégante et conviviale pour accompagner votre réception.",
      detail: "Vin d'honneur, soirée, ou les deux : la carte et le rythme du service s'adaptent au déroulé de votre journée.",
      img: 'assets/evenement-vin-honneur.jpg',
      alt: "Vin d'honneur sous la pergola : les invités se servent au bar installé pour la réception." },
    { id: 'anniv',      titre: 'Anniversaires',
      type: 'Anniversaire',
      texte: "Des cocktails personnalisés pour créer une ambiance festive et mémorable.",
      detail: "On choisit ensemble les cocktails que vos invités vont aimer, avec des versions sans alcool pour tout le monde.",
      img: 'assets/buffet-evenement.jpg',
      alt: "Grande table dressée en extérieur : empanadas, bouchées et jarre de cocktail à partager." },
    { id: 'pro',        titre: 'Événements professionnels',
      type: "Événement d'entreprise",
      texte: "Une prestation cocktail adaptée aux entreprises, séminaires et événements professionnels.",
      detail: "Afterwork, lancement, séminaire ou soirée de fin d'année : un format cadré, un devis clair, une installation discrète.",
      img: 'assets/buffet-canapes.jpg',
      alt: "Présentoir de bouchées et verres au sel pimenté, prêts pour le service." },
    { id: 'soiree',     titre: 'Soirées privées',
      type: 'Soirée privée',
      texte: "Transformez votre soirée en véritable bar à cocktails.",
      detail: "Chez vous, dans un jardin ou une salle louée : le bar devient le point de rendez-vous de la soirée.",
      img: 'assets/cocktail-margarita.jpg',
      alt: "Margarita au bord givré d'épices, préparée par Clem." },
    { id: 'atelier',    titre: 'Atelier cocktail',
      type: 'Atelier cocktail',
      texte: "Viens créer ton propre cocktail.",
      detail: "Une idée pour un EVJF, un EVG, un anniversaire, ou simplement pour faire découvrir une nouvelle expérience et impressionner vos amis ou votre famille. Au programme : Mojito, Piña Colada, Margarita…",
      lieu: "Au Barrio Latino, à Clermont-Ferrand",
      prix: "30 € par personne",
      img: 'assets/pisco-sour-service.jpg',
      alt: "Pisco Sours dressés au bar, mousse et cannelle, prêts à être dégustés." },
    { id: 'surmesure',  titre: 'Événements sur mesure',
      type: 'Événement sur mesure',
      texte: "Une prestation entièrement personnalisée selon vos envies.",
      detail: "Une idée qui n'entre dans aucune case ? Décrivez-la dans le formulaire, on construit la formule ensemble.",
      img: 'assets/dosage-citron.jpg',
      alt: "Dosage du jus de citron vert au jigger : chaque cocktail est mesuré." }
  ];

  // Recettes et prix relevés sur les publications @cocktailsbyclem_.
  const SIGNATURES = [
    { nom: 'Pisco Sour', pays: 'Pérou',  img: 'pisco-sour',
      recette: "Pisco, jus de citron vert, sirop de sucre, blanc d'œuf" },
    { nom: 'Margarita',  pays: 'Mexique', img: 'margarita',
      recette: "Tequila, jus de citron vert, sirop de sucre" },
    { nom: 'Chilcano',   pays: 'Pérou',  img: 'chilcano',
      recette: "Pisco, jus de citron vert, ginger ale" }
  ];
  const CLASSIQUES = [
    { nom: 'Piña Colada', pays: 'Porto Rico', img: 'pina-colada',
      recette: "Jus d'ananas, crème de coco, rhum brun, sirop de sucre" },
    { nom: 'Mojito',      pays: 'Cuba',   img: 'mojito',
      recette: "Rhum blanc, menthe, citron vert, sirop de sucre, eau pétillante" },
    { nom: 'Cuba Libre',  pays: 'Cuba',   img: 'cuba-libre',
      recette: "Rhum blanc, jus de citron, coca cola" }
  ];

  const EVENEMENTS = [
    { nom: 'Mariage',                 type: 'Mariage',                  ico: 'i-rings' },
    { nom: 'Anniversaire',            type: 'Anniversaire',             ico: 'i-cake' },
    { nom: 'Soirée privée',           type: 'Soirée privée',            ico: 'i-music' },
    { nom: "Événement d'entreprise",  type: "Événement d'entreprise",   ico: 'i-case' },
    { nom: 'Cocktail dînatoire',      type: 'Cocktail dînatoire',       ico: 'i-plate' },
    { nom: 'Fête privée',             type: 'Fête privée',              ico: 'i-confetti' },
    { nom: 'EVJF / EVG',               type: 'EVJF / EVG',               ico: 'i-glasses' },
    { nom: 'Événement sur mesure',    type: 'Événement sur mesure',     ico: 'i-sparkle' }
  ];

  /* --- 2. Rendu --------------------------------------------------------- */

  const srv = $('#srv');
  if (srv) {
    srv.innerHTML = SERVICES.map((s, i) => `
      <div class="srv__item">
        <button class="srv__btn" type="button" aria-expanded="false" aria-controls="p-${s.id}" id="b-${s.id}">
          <h3>${esc(s.titre)}</h3>
          <svg class="ico srv__sign" aria-hidden="true"><use href="#i-plus"/></svg>
        </button>
        <div class="srv__panel" id="p-${s.id}" role="region" aria-labelledby="b-${s.id}" data-open="false">
          <div class="srv__inner"><div class="srv__body">
            <div>
              <p>${esc(s.texte)}</p>
              <p>${esc(s.detail)}</p>
              ${s.lieu ? `<p class="srv__lieu"><svg class="ico" aria-hidden="true"><use href="#i-pin"/></svg>${esc(s.lieu)}</p>` : ''}
              ${s.prix ? `<p class="srv__prix"><span class="num">${esc(s.prix)}</span></p>` : ''}
              <a class="btn btn-primary" href="#devis" data-type="${esc(s.type)}">
                Demander un devis</a>
            </div>
            <div class="frame frame--wide">
              <img src="${s.img}" alt="${esc(s.alt)}" width="600" height="450" loading="lazy" decoding="async">
            </div>
          </div></div>
        </div>
      </div>`).join('');
  }

  const cocktailCard = (c) => c.todo ? `
    <article class="ckt ckt--todo">
      <div class="ckt__img"><svg class="ico" aria-hidden="true"><use href="#i-glass"/></svg></div>
      <h3>${esc(c.nom)}</h3>
      <em class="recipe">${esc(c.recette)}</em>
    </article>` : `
    <article class="ckt">
      <div class="ckt__img">
        <img src="assets/cocktails/${c.img}.jpg" alt="Illustration du cocktail ${esc(c.nom)}." width="440" height="440" loading="lazy" decoding="async">
      </div>
      <h3>${esc(c.nom)}</h3>
      <em class="recipe">${esc(c.recette)}</em>
      ${c.pays ? `<span class="ckt__origin">${esc(c.pays)}</span>` : ''}
    </article>`;

  const sig = $('#carte-signatures');
  const cla = $('#carte-classiques');
  if (sig) sig.innerHTML = SIGNATURES.map((c, i) => cocktailCard(c).replace('<article', `<article style="--i:${i}"`)).join('');
  if (cla) cla.innerHTML = CLASSIQUES.map((c, i) => cocktailCard(c).replace('<article', `<article style="--i:${i}"`)).join('');

  const evt = $('#evt');
  if (evt) {
    evt.innerHTML = EVENEMENTS.map((e, i) => `
      <a class="evt__item${e.wide ? ' evt__item--wide' : ''}" href="#devis"
         data-type="${esc(e.type)}" style="--i:${i}">
        <svg class="ico" aria-hidden="true"><use href="#${e.ico}"/></svg>
        <span>${esc(e.nom)}</span>
      </a>`).join('');
  }

  /* --- 3. En-tête ------------------------------------------------------- */

  const hdr = $('#hdr');
  const dock = $('#dock');
  const hero = $('#accueil');

  const io0 = new IntersectionObserver(([e]) => {
    hdr.classList.toggle('is-stuck', !e.isIntersecting);
    if (dock) dock.classList.toggle('is-on', !e.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' });
  if (hero) io0.observe(hero);

  // Rubrique courante dans la navigation.
  const navLinks = $$('#nav a');
  const targets = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if (targets.length) {
    const io1 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) =>
          a.setAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id ? 'true' : 'false'));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => io1.observe(t));
  }

  /* --- 4. Menu mobile --------------------------------------------------- */

  const burger = $('#burger');
  const menu = $('#menu');
  if (burger && menu) {
    menu.hidden = false;
    const setMenu = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) menu.querySelector('a').focus();
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
  }

  /* --- 5. Révélations --------------------------------------------------- */

  const revealables = $$('.reveal, .reveal-stagger, .head, .hero');
  if (reduced.matches) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const io2 = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        obs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => io2.observe(el));
    // Le premier écran ne doit jamais attendre l'observateur.
    requestAnimationFrame(() => $$('.hero, .hero .head').forEach((el) => el.classList.add('is-in')));
  }

  /* --- 6. Parallaxe très légère ---------------------------------------- */

  const layers = $$('[data-parallax]');
  if (layers.length && !reduced.matches && matchMedia('(pointer:fine)').matches) {
    let ticking = false;
    const paint = () => {
      const vh = innerHeight;
      layers.forEach((el) => {
        const host = el.closest('section') || el.parentElement;
        const r = host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh;      // −1 … 1
        el.style.transform = `translate3d(0, ${(p * parseFloat(el.dataset.parallax) * 100).toFixed(2)}px, 0)`;
      });
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /* --- 7. Accordéon des services --------------------------------------- */

  $$('.srv__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      $$('.srv__btn').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
        $('#' + b.getAttribute('aria-controls')).dataset.open = 'false';
      });
      if (!open) {
        btn.setAttribute('aria-expanded', 'true');
        $('#' + btn.getAttribute('aria-controls')).dataset.open = 'true';
      }
    });
  });

  /* --- 8. Formulaire ---------------------------------------------------- */

  const form = $('#devis-form');
  const status = $('#form-status');

  // Un clic sur une prestation ou un type d'événement pré-remplit le formulaire.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-type]');
    if (!a) return;
    const sel = $('#f-type');
    if (!sel) return;
    const wanted = a.dataset.type;
    const opt = Array.from(sel.options).find((o) => o.value === wanted || o.text === wanted);
    if (opt) { sel.value = opt.value || opt.text; sel.dispatchEvent(new Event('change')); }
  });

  if (form) {
    const RULES = {
      prenom: (v) => !v.trim() ? 'Indiquez votre prénom.' : '',
      nom:    (v) => !v.trim() ? 'Indiquez votre nom.' : '',
      email:  (v) => !v.trim() ? 'Indiquez votre email pour recevoir la proposition.'
                   : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "Cet email semble incomplet — il manque le @ ou le nom de domaine." : '',
      tel:    (v) => !v.trim() ? 'Indiquez un téléphone pour être rappelé.'
                   : v.replace(/[^\d+]/g, '').length < 9 ? 'Ce numéro paraît trop court : vérifiez les chiffres.' : '',
      type:   (v) => !v ? "Choisissez le type d'événement." : '',
      date:   (v) => {
        if (!v) return '';
        const d = new Date(v + 'T00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
        return d < t ? "Cette date est déjà passée — choisissez une date à venir." : '';
      },
      invites: (v) => {
        if (!v.trim()) return '';
        const n = Number(v);
        return (!Number.isFinite(n) || n < 1) ? "Indiquez un nombre d'invités, même approximatif."
             : n > 2000 ? "Au-delà de 2000 invités, écrivez-moi plutôt directement sur WhatsApp." : '';
      },
      lieu: () => '', message: () => ''
    };

    const fieldOf = (name) => form.elements[name];
    const errOf = (name) => $('#e-' + ({ prenom: 'prenom', nom: 'nom', email: 'email', tel: 'tel',
      type: 'type', date: 'date', lieu: 'lieu', invites: 'invites', message: 'msg' }[name]));

    const check = (name, live) => {
      const el = fieldOf(name); const box = errOf(name);
      if (!el || !box) return true;
      const msg = (RULES[name] || (() => ''))(el.value);
      // En saisie, on n'affiche une erreur que si le champ en portait déjà une.
      if (live && !box.textContent) return !msg;
      box.innerHTML = msg
        ? `<svg class="ico" aria-hidden="true"><use href="#i-alert"/></svg><span>${esc(msg)}</span>` : '';
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    };

    Object.keys(RULES).forEach((name) => {
      const el = fieldOf(name);
      if (!el) return;
      el.addEventListener('blur', () => check(name, false));
      el.addEventListener('input', () => check(name, true));
      el.addEventListener('change', () => check(name, true));
    });

    const say = (state, text, href) => {
      status.dataset.state = state;
      const span = status.querySelector('span');
      span.textContent = text;
      if (href) {
        span.append(' ');
        const a = document.createElement('a');
        a.href = href; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Ouvrir WhatsApp';
        span.append(a);
      }
      status.querySelector('use').setAttribute('href', state === 'ok' ? '#i-check' : '#i-alert');
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const names = Object.keys(RULES);
      const bad = names.filter((n) => !check(n, false));
      if (bad.length) {
        say('err', `Il manque ${bad.length === 1 ? 'une information' : bad.length + ' informations'} pour préparer votre devis.`);
        const first = fieldOf(bad[0]);
        first.focus({ preventScroll: true });
        first.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.dataset.loading = 'true';

      const g = (n) => (fieldOf(n)?.value || '').trim();
      const dateFr = g('date')
        ? new Date(g('date') + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'à définir';

      const lignes = [
        `Bonjour Clem, je souhaite un devis pour un événement.`,
        ``,
        `Nom : ${g('prenom')} ${g('nom')}`,
        `Email : ${g('email')}`,
        `Téléphone : ${g('tel')}`,
        `Type d'événement : ${g('type')}`,
        `Date : ${dateFr}`,
        `Lieu : ${g('lieu') || 'à définir'}`,
        `Nombre d'invités : ${g('invites') || 'à définir'}`
      ];
      if (g('message')) lignes.push(``, `Message :`, g('message'));
      lignes.push(``, `— envoyé depuis le site Cocktails by Clem`);

      const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lignes.join('\n'))}`;

      // `window.open(..., 'noopener')` renvoie toujours null : impossible d'en
      // deduire un echec. On declenche un vrai lien, et on laisse dans le
      // statut un lien de secours si le navigateur a bloque l'ouverture.
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();

      btn.dataset.loading = 'false';
      say('ok', "Votre message est prêt dans WhatsApp — il ne part que lorsque vous l'envoyez. "
              + "Si rien ne s'est ouvert :", url);
    });
  }

  /* --- 9. Carte Google, chargée sur demande ----------------------------- */

  const mapBtn = $('#map-load');
  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = 'https://www.google.com/maps?q=Clermont-Ferrand,+Puy-de-D%C3%B4me,+France&z=11&output=embed';
      f.title = "Carte de la zone d'intervention : Clermont-Ferrand et le Puy-de-Dôme";
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
      mapBtn.replaceWith(f);
    });
  }

  /* --- 10. Divers ------------------------------------------------------- */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Une photo absente ne doit pas laisser une icône cassée dans la page.
  addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
    img.dataset.failed = '1';
    const host = img.closest('.frame, .ckt__img, .ig__feed a');
    if (host) {
      host.classList.add('slot');
      host.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-image"/></svg>
        <p class="label" style="margin:0">Photo à ajouter</p><code>${esc(img.getAttribute('src'))}</code>`;
    }
  }, true);
})();
