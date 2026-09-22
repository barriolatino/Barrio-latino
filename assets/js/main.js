/* ==========================================================================
   Barrio Latino — interactions
   Aucune dependance. Tout est progressif : sans JS, le contenu essentiel
   (coordonnees, horaires, liens) reste dans le HTML.
   ========================================================================== */
(function () {
  'use strict';

  var WHATSAPP = '33763920998';
  var EMAIL = 'barriolatino.contact@gmail.com';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* Icones SVG reutilisees par le JS (les autres sont inline dans le HTML) */
  var ICON = {
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>',
    google: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 12.2c0-.7-.06-1.35-.18-2H12v3.8h5.4a4.7 4.7 0 0 1-2 3.05v2.5h3.2c1.9-1.75 3-4.32 3-7.35z"/><path d="M12 22c2.7 0 4.96-.9 6.6-2.43l-3.2-2.5c-.9.6-2.04.95-3.4.95a5.98 5.98 0 0 1-5.62-4.13H3.06v2.6A9.98 9.98 0 0 0 12 22z"/><path d="M6.38 13.89a6 6 0 0 1 0-3.79V7.5H3.06a10 10 0 0 0 0 9z"/><path d="M12 6.05c1.47 0 2.79.5 3.83 1.5l2.84-2.84A9.95 9.95 0 0 0 12 2a9.98 9.98 0 0 0-8.94 5.5l3.32 2.6A5.98 5.98 0 0 1 12 6.05z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l6.5-15L21 17.5z"/><path d="M14 3.5l.9 1.8 1.9.3-1.4 1.4.3 1.9-1.7-.9-1.7.9.3-1.9L11.2 5.6l1.9-.3z"/></svg>'
  };

  function stars(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ICON.star;
    return s;
  }

  /* ======================================================================
     1. En-tete : ombre au scroll, menu burger, lien de section actif
     ====================================================================== */
  var header = $('.header');
  var burger = $('.burger');
  var navLinks = $('.nav-links');

  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('is-open', !open);
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        burger.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        burger.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
        burger.focus();
      }
    });
  }

  /* Lien de navigation correspondant a la section visible */
  var spied = $$('.nav-links a[href^="#"]').map(function (a) {
    return { a: a, sec: document.getElementById(a.getAttribute('href').slice(1)) };
  }).filter(function (x) { return x.sec; });

  if (spied.length) {
    /* On recalcule la section courante a chaque scroll : marquer les liens
       depuis les entrees d'un IntersectionObserver laissait deux liens actifs
       quand deux sections croisaient la ligne de reference dans le meme lot. */
    var spyTick = false;
    function markCurrent() {
      var line = (window.innerHeight || 0) * 0.35;
      var active = null;
      spied.forEach(function (x) {
        var r = x.sec.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) active = x;
      });
      spied.forEach(function (x) {
        if (x === active) x.a.setAttribute('aria-current', 'true');
        else x.a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () {
      if (spyTick) return;
      spyTick = true;
      window.requestAnimationFrame(function () { spyTick = false; markCurrent(); });
    }, { passive: true });
    window.addEventListener('resize', markCurrent, { passive: true });
    markCurrent();
  }

  /* ======================================================================
     2. Reveal au scroll
     ====================================================================== */
  var revealables = $$('.reveal');
  if (revealables.length) {
    if (REDUCED.matches || !('IntersectionObserver' in window)) {
      revealables.forEach(function (n) { n.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      revealables.forEach(function (n) { io.observe(n); });
    }
  }

  /* ======================================================================
     3. Horaires : jour en cours + « ouvert / ferme » a l'heure de Paris
     ====================================================================== */
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  /* Minutes depuis minuit. 12h30 = 750, 15h00 = 900, 19h00 = 1140, 22h00 = 1320 */
  var SERVICES = { 3: [[750, 900], [1140, 1320]], 4: [[750, 900], [1140, 1320]],
                   5: [[750, 900], [1140, 1320]], 6: [[750, 900], [1140, 1320]] };

  function parisNow() {
    try {
      var parts = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris', weekday: 'short', hourCycle: 'h23',
        hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      var dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        dow: dows[parts.weekday],
        min: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10),
        iso: parts.year + '-' + parts.month + '-' + parts.day
      };
    } catch (e) {
      var d = new Date();
      return { dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes(),
               iso: d.toISOString().slice(0, 10) };
    }
  }

  function hhmm(m) {
    return (m / 60 | 0) + 'h' + String(m % 60).padStart(2, '0');
  }

  (function renderStatus() {
    var box = $('#statut');
    var now = parisNow();

    $$('.hours [data-dow]').forEach(function (row) {
      if (parseInt(row.getAttribute('data-dow'), 10) === now.dow) row.classList.add('is-today');
    });
    if (!box) return;

    var today = SERVICES[now.dow] || [];
    var open = today.some(function (s) { return now.min >= s[0] && now.min < s[1]; });
    var label;

    if (open) {
      var cur = today.filter(function (s) { return now.min >= s[0] && now.min < s[1]; })[0];
      label = 'Ouvert maintenant — jusqu’à ' + hhmm(cur[1]);
    } else {
      var next = null;
      for (var i = 0; i <= 7 && !next; i++) {
        var d = (now.dow + i) % 7;
        var svc = SERVICES[d] || [];
        for (var j = 0; j < svc.length; j++) {
          if (i > 0 || svc[j][0] > now.min) { next = { d: d, m: svc[j][0], i: i }; break; }
        }
      }
      label = next
        ? 'Fermé — ouverture ' + (next.i === 0 ? 'aujourd’hui' : (next.i === 1 ? 'demain' : next.d === now.dow ? 'dans une semaine' : JOURS[next.d])) + ' à ' + hhmm(next.m)
        : 'Fermé';
    }
    box.className = 'status ' + (open ? 'status--open' : 'status--closed');
    box.innerHTML = '<i aria-hidden="true"></i>' + label;
  })();

  /* ======================================================================
     4. La carte (assets/data/menu.json)
     ====================================================================== */
  function renderMenu(data) {
    var tablist = $('#menuTabs');
    var panels = $('#menuPanels');
    if (!tablist || !panels) return;

    tablist.innerHTML = '';
    panels.innerHTML = '';

    data.categories.forEach(function (cat, i) {
      var tab = el('button', {
        type: 'button', role: 'tab', id: 'tab-' + cat.id, class: 'tab',
        'aria-controls': 'panel-' + cat.id, 'aria-selected': String(i === 0),
        tabindex: i === 0 ? '0' : '-1', text: cat.label
      });
      tablist.appendChild(tab);

      var list = el('div', { class: 'dishes' });
      cat.plats.forEach(function (p) {
        var title = el('h4', {}, [document.createTextNode(p.nom)]);
        if (p.vege) title.appendChild(el('span', { class: 'tag-vege', text: 'Végétarien' }));
        var row = el('article', { class: 'dish' + (p.photo ? ' dish--photo' : '') }, [title]);

        if (p.photo) {
          /* alt vide : le nom du plat est juste a cote, une description de
             l'image ferait doublon a l'oreille d'un lecteur d'ecran. */
          var pic = el('picture', { class: 'dish-photo' }, [
            el('source', { srcset: 'assets/img/plats/vignettes/' + p.photo + '.webp', type: 'image/webp' }),
            el('img', {
              src: 'assets/img/plats/vignettes/' + p.photo + '.jpg',
              width: '232', height: '174', alt: '', loading: 'lazy', decoding: 'async'
            })
          ]);
          row.appendChild(pic);
        }

        row.appendChild(el('span', { class: 'price', text: p.prix }));
        if (p.description) row.appendChild(el('p', { text: p.description }));
        list.appendChild(row);
      });

      var head = el('div', { class: 'menu-panel-head' }, [
        el('h3', { text: cat.label }),
        el('span', { text: cat.label_es || '' })
      ]);
      if (cat.note) head.appendChild(el('span', { class: 'menu-note', text: cat.note }));

      panels.appendChild(el('div', {
        id: 'panel-' + cat.id, role: 'tabpanel', class: 'menu-panel',
        'aria-labelledby': 'tab-' + cat.id, tabindex: '0', hidden: i === 0 ? null : 'hidden'
      }, [head, list]));
    });

    var tabs = $$('.tab', tablist);
    function select(idx, focus) {
      tabs.forEach(function (t, i) {
        var on = i === idx;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', 'hidden'); }
      });
      if (focus) {
        tabs[idx].focus();
        tabs[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
    });
    tablist.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); select(n, true); }
    });

    var mention = $('#menuMention');
    if (mention && data.mention) mention.textContent = data.mention;
    var uber = $('#uberLink');
    if (uber) {
      if (data.lien_uber_eats) { uber.href = data.lien_uber_eats; uber.hidden = false; }
      else { uber.hidden = true; }
    }
  }

  /* ======================================================================
     5. Avis (assets/data/avis.json) + carrousel
     ====================================================================== */
  function renderAvis(data) {
    var track = $('#avisTrack');
    if (!track) return;

    $$('[data-note]').forEach(function (n) {
      n.textContent = String(data.note).replace('.', ',');
    });
    $$('[data-nb-avis]').forEach(function (n) { n.textContent = data.nombre; });
    $$('[data-lien-avis]').forEach(function (n) {
      if (data.lien_tous_les_avis) n.href = data.lien_tous_les_avis;
    });
    $$('[data-stars]').forEach(function (n) {
      n.innerHTML = stars(Math.round(data.note));
    });

    track.innerHTML = '';
    data.avis.forEach(function (a) {
      var who = el('div', { class: 'avis-who' }, [
        el('span', { class: 'avatar', 'aria-hidden': 'true', text: a.auteur.charAt(0) }),
        el('b', { text: a.auteur })
      ]);
      if (a.local_guide) who.appendChild(el('span', { class: 'badge-lg', text: 'Local Guide' }));

      track.appendChild(el('li', {}, [
        el('article', { class: 'avis-card' }, [
          el('div', { class: 'stars', role: 'img', 'aria-label': a.etoiles + ' étoiles sur 5',
                      html: stars(a.etoiles) }),
          el('blockquote', { text: '« ' + a.texte + ' »' }),
          who,
          el('p', { class: 'avis-src', html: ICON.google + '<span>Avis Google</span>' })
        ])
      ]));
    });

    initCarousel();
  }

  function initCarousel() {
    var root = $('#carousel');
    var track = $('#avisTrack');
    var dots = $('#carouselDots');
    var live = $('#carouselLive');
    if (!root || !track) return;

    var items = $$('li', track);
    var index = 0, timer = null, paused = false;

    function perView() {
      if (!items.length) return 1;
      return Math.max(1, Math.round(track.clientWidth / items[0].getBoundingClientRect().width));
    }
    function maxIndex() { return Math.max(0, items.length - perView()); }

    function go(i, announce) {
      index = Math.min(Math.max(i, 0), maxIndex());
      track.style.transform = 'translateX(' + (-index * (100 / perView())) + '%)';
      $$('button', dots).forEach(function (d, k) {
        d.setAttribute('aria-current', String(k === index));
      });
      items.forEach(function (li, k) {
        var visible = k >= index && k < index + perView();
        li.setAttribute('aria-hidden', String(!visible));
        $$('a, button', li).forEach(function (f) { f.tabIndex = visible ? 0 : -1; });
      });
      if (announce && live) live.textContent = 'Avis ' + (index + 1) + ' sur ' + (maxIndex() + 1);
    }

    dots.innerHTML = '';
    for (var k = 0; k <= maxIndex(); k++) {
      (function (kk) {
        dots.appendChild(el('button', {
          type: 'button', 'aria-label': 'Aller à l’avis ' + (kk + 1)
        }));
      })(k);
    }
    $$('button', dots).forEach(function (d, k) {
      d.addEventListener('click', function () { go(k, true); restart(); });
    });

    $('#avisPrev').addEventListener('click', function () {
      go(index <= 0 ? maxIndex() : index - 1, true); restart();
    });
    $('#avisNext').addEventListener('click', function () {
      go(index >= maxIndex() ? 0 : index + 1, true); restart();
    });

    function tick() { go(index >= maxIndex() ? 0 : index + 1, false); }
    function start() {
      if (REDUCED.matches || paused || items.length <= perView()) return;
      stop();
      timer = window.setInterval(tick, 6000);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) {
      root.addEventListener(ev, function () { paused = true; stop(); }, { passive: true });
    });
    ['mouseleave', 'focusout'].forEach(function (ev) {
      root.addEventListener(ev, function () {
        if (root.contains(document.activeElement)) return;
        paused = false; start();
      });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    /* Balayage tactile */
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) go(dx < 0 ? index + 1 : index - 1, true);
      x0 = null;
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        dots.innerHTML = '';
        for (var k = 0; k <= maxIndex(); k++) {
          dots.appendChild(el('button', { type: 'button', 'aria-label': 'Aller à l’avis ' + (k + 1) }));
        }
        $$('button', dots).forEach(function (d, k) {
          d.addEventListener('click', function () { go(k, true); restart(); });
        });
        go(Math.min(index, maxIndex()), false);
      }, 180);
    });

    go(0, false);
    start();
    REDUCED.addEventListener('change', function () { REDUCED.matches ? stop() : start(); });
  }

  /* ======================================================================
     6. Evenements (assets/data/evenements.json)
     ====================================================================== */
  function renderEvents(data) {
    var next = $('#nextEvent');
    if (next) {
      if (data.prochain && data.prochain.titre) {
        next.innerHTML = '';
        next.appendChild(el('span', { class: 'event-flag', 'aria-hidden': 'true', html: ICON.party }));
        /* Sans date annoncée, « Prochain événement » promettrait une
           information que l'encart n'a pas : le programme est publié sur
           Instagram. */
        var body = el('div', {}, [
          el('p', { class: 'eyebrow', text: data.prochain.date ? 'Prochain événement' : 'À l\u2019affiche' }),
          el('h3', { text: data.prochain.titre + (data.prochain.date ? ' — ' + data.prochain.date : '') }),
          el('p', { text: data.prochain.description || '' })
        ]);
        next.appendChild(body);
        next.appendChild(el('a', {
          class: 'btn btn--turquoise', href: data.prochain.lien || 'https://www.instagram.com/barriolatino_fr',
          target: '_blank', rel: 'noopener', text: 'Voir sur Instagram'
        }));
        next.hidden = false;
      } else {
        next.hidden = true;
      }
    }

    var list = $('#eventCards');
    if (!list) return;
    list.innerHTML = '';
    (data.recurrents || []).forEach(function (ev) {
      list.appendChild(el('article', { class: 'card event-card' }, [
        el('p', { class: 'accroche', text: ev.accroche || '' }),
        el('h3', { text: ev.titre }),
        el('p', { text: ev.description || '' })
      ]));
    });
  }

  /* ======================================================================
     7. Galerie : lightbox accessible (clavier + balayage)
     ====================================================================== */
  (function lightbox() {
    var dlg = $('#lightbox');
    var groupes = $$('[data-galerie]');
    if (!dlg || !groupes.length) return;

    var img = $('#lbImg');
    var cap = $('#lbCap');
    var live = $('#lbLive');
    var slides = [], i = 0, opener = null;

    function show(n) {
      i = (n + slides.length) % slides.length;
      img.src = slides[i].src;
      img.alt = slides[i].alt;
      cap.textContent = slides[i].alt;
      if (live) live.textContent = 'Photo ' + (i + 1) + ' sur ' + slides.length;
    }

    /* Chaque conteneur [data-galerie] forme son propre jeu de photos : les
       fleches de la lightbox restent dans la galerie ou l'on a cliqué, au
       lieu de deriver vers celle de la section voisine. */
    groupes.forEach(function (g) {
      var shots = $$('.shot', g);
      var jeu = shots.map(function (b) {
        var im = $('img', b);
        return { src: b.getAttribute('data-full') || im.currentSrc || im.src, alt: im.alt };
      });
      shots.forEach(function (b, n) {
        b.addEventListener('click', function () {
          opener = b; slides = jeu; show(n);
          if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
          $('#lbClose').focus();
        });
      });
    });

    $('#lbClose').addEventListener('click', function () { dlg.close(); });
    $('#lbPrev').addEventListener('click', function () { show(i - 1); });
    $('#lbNext').addEventListener('click', function () { show(i + 1); });

    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close();
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    });
    dlg.addEventListener('close', function () { if (opener) opener.focus(); });

    var x0 = null;
    dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(dx < 0 ? i + 1 : i - 1);
      x0 = null;
    });
  })();

  /* ======================================================================
     8. Reservation : calendrier mer.→sam., validation, envoi WhatsApp
     ====================================================================== */
  (function reservation() {
    var form = $('#resForm');
    if (!form) return;

    var OUVERTS = [3, 4, 5, 6];           /* mercredi, jeudi, vendredi, samedi */
    var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var DOW = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

    var grid = $('#calGrid');
    var title = $('#calTitle');
    var prev = $('#calPrev');
    var next = $('#calNext');
    var hidden = $('#resDate');
    var live = $('#calLive');

    var todayIso = parisNow().iso;
    var view = new Date(todayIso + 'T12:00:00');
    view.setDate(1);
    var limit = new Date(view); limit.setMonth(limit.getMonth() + 11);
    var chosen = null;

    function iso(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0');
    }
    function labelFr(isoStr) {
      var d = new Date(isoStr + 'T12:00:00');
      return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()] +
             ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
    }

    function draw() {
      title.textContent = MOIS[view.getMonth()] + ' ' + view.getFullYear();
      grid.innerHTML = '';
      DOW.forEach(function (d) {
        grid.appendChild(el('div', { class: 'cal-dow', 'aria-hidden': 'true', text: d }));
      });

      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7;                      /* semaine commencant lundi */
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

      for (var k = 0; k < lead; k++) grid.appendChild(el('div', { class: 'cal-empty' }));

      for (var d = 1; d <= days; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d);
        var is = iso(date);
        var ok = OUVERTS.indexOf(date.getDay()) > -1 && is >= todayIso;
        var btn = el('button', {
          type: 'button', class: 'cal-day', text: String(d),
          'data-iso': is,
          'aria-pressed': String(chosen === is),
          'aria-label': labelFr(is) + (ok ? '' : ' — fermé'),
          tabindex: '-1'
        });
        if (!ok) btn.disabled = true;
        grid.appendChild(btn);
      }

      var usable = $$('.cal-day:not(:disabled)', grid);
      var focusTarget = usable.filter(function (b) { return b.getAttribute('data-iso') === chosen; })[0] || usable[0];
      if (focusTarget) focusTarget.tabIndex = 0;

      prev.disabled = view.getFullYear() === new Date(todayIso + 'T12:00:00').getFullYear() &&
                      view.getMonth() === new Date(todayIso + 'T12:00:00').getMonth();
      next.disabled = view >= limit;
    }

    function pick(btn) {
      chosen = btn.getAttribute('data-iso');
      hidden.value = chosen;
      $$('.cal-day', grid).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
        b.tabIndex = b === btn ? 0 : -1;
      });
      clearError('resDate');
      if (live) live.textContent = 'Date choisie : ' + labelFr(chosen);
    }

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.cal-day');
      if (b && !b.disabled) pick(b);
    });
    grid.addEventListener('keydown', function (e) {
      var usable = $$('.cal-day:not(:disabled)', grid);
      var at = usable.indexOf(document.activeElement);
      if (at < 0) return;
      var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      var n = usable[Math.min(Math.max(at + step, 0), usable.length - 1)];
      if (n) { n.tabIndex = 0; document.activeElement.tabIndex = -1; n.focus(); }
    });
    prev.addEventListener('click', function () { view.setMonth(view.getMonth() - 1); draw(); });
    next.addEventListener('click', function () { view.setMonth(view.getMonth() + 1); draw(); });
    draw();

    /* --- Validation --------------------------------------------------- */
    function showError(id, msg) {
      var f = document.getElementById(id);
      var box = document.getElementById('err-' + id);
      if (f) f.setAttribute('aria-invalid', 'true');
      if (box) { box.innerHTML = ICON.alert + '<span>' + msg + '</span>'; box.classList.add('is-shown'); }
    }
    function clearError(id) {
      var f = document.getElementById(id);
      var box = document.getElementById('err-' + id);
      if (f) f.removeAttribute('aria-invalid');
      if (box) { box.classList.remove('is-shown'); box.textContent = ''; }
    }

    ['resName', 'resPhone', 'resPeople'].forEach(function (id) {
      var f = document.getElementById(id);
      if (f) f.addEventListener('input', function () { clearError(id); });
    });
    $$('input[name="creneau"]').forEach(function (r) {
      r.addEventListener('change', function () { clearError('creneau'); });
    });

    function validate() {
      var bad = [];
      var name = $('#resName').value.trim();
      var phone = $('#resPhone').value.trim();
      var people = $('#resPeople').value;
      var slot = $('input[name="creneau"]:checked');

      if (name.length < 2) { showError('resName', 'Merci d’indiquer votre nom.'); bad.push('resName'); }
      else clearError('resName');

      if (!people) { showError('resPeople', 'Indiquez le nombre de personnes.'); bad.push('resPeople'); }
      else clearError('resPeople');

      if (!chosen) { showError('resDate', 'Choisissez une date dans le calendrier (mercredi à samedi).'); bad.push('resDate'); }
      else clearError('resDate');

      if (!slot) { showError('creneau', 'Choisissez le déjeuner ou le dîner.'); bad.push('creneau'); }
      else clearError('creneau');

      if (!/^[0-9+\s().-]{8,}$/.test(phone)) {
        showError('resPhone', 'Numéro de téléphone incomplet.'); bad.push('resPhone');
      } else clearError('resPhone');

      if (bad.length) {
        var first = document.getElementById(bad[0]);
        if (bad[0] === 'resDate') first = $('.cal-day:not(:disabled)', grid);
        if (bad[0] === 'creneau') first = $('input[name="creneau"]');
        if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
        return null;
      }

      return {
        nom: name,
        personnes: people,
        date: labelFr(chosen),
        creneau: slot.getAttribute('data-label'),
        tel: phone,
        note: $('#resNote').value.trim()
      };
    }

    function message(r) {
      var t = 'Bonjour Barrio Latino ! Je souhaite réserver une table.\n\n' +
              'Nom : ' + r.nom + '\n' +
              'Personnes : ' + r.personnes + '\n' +
              'Date : ' + r.date + '\n' +
              'Service : ' + r.creneau + '\n' +
              'Téléphone : ' + r.tel;
      if (r.note) t += '\nPrécisions : ' + r.note;
      t += '\n\nMerci !';
      return t;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = validate();
      if (!r) return;
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message(r)), '_blank', 'noopener');
      var ok = $('#resDone');
      if (ok) { ok.hidden = false; ok.focus(); }
    });

    $('#resMail').addEventListener('click', function (e) {
      e.preventDefault();
      var r = validate();
      if (!r) return;
      window.location.href = 'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent('Réservation — ' + r.nom + ' — ' + r.date) +
        '&body=' + encodeURIComponent(message(r));
    });
  })();

  /* ======================================================================
     9. Bouton flottant reseaux
     ====================================================================== */
  (function fab() {
    var box = $('#fab');
    var toggle = $('#fabToggle');
    if (!box || !toggle) return;
    function close() { box.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); }
    toggle.addEventListener('click', function () {
      var open = box.dataset.open === 'true';
      box.dataset.open = String(!open);
      toggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.dataset.open === 'true') { close(); toggle.focus(); }
    });

    /* Le bouton flottant est masque au-dessus de la section Reserver : il y
       ferait doublon avec les pastilles de contact et, sur mobile, il se
       superpose au formulaire. */
    var res = $('#reserver');
    if (res && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          box.classList.toggle('fab--away', en.isIntersecting);
          if (en.isIntersecting) close();
        });
      }, { threshold: 0.12 }).observe(res);
    }
  })();

  /* ======================================================================
     10. Chargement des donnees
     ====================================================================== */
  function load(file, render, fallbackSelector) {
    fetch('assets/data/' + file, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + file);
        return r.json();
      })
      .then(render)
      .catch(function (err) {
        console.warn('Barrio Latino : ' + file + ' illisible —', err.message);
        var box = fallbackSelector && $(fallbackSelector);
        if (box) box.hidden = false;
      });
  }

  load('menu.json', renderMenu, '#menuFallback');
  load('avis.json', renderAvis, '#avisFallback');
  load('evenements.json', renderEvents, '#eventsFallback');
})();
