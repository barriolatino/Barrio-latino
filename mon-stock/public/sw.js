// Cache de l'interface seulement. Les données (/api) ne sont JAMAIS mises en cache :
// un stock affiché hors ligne serait trompeur, et aucune opération n'est mise en attente.
const VERSION = "mon-stock-v2";
const COQUILLE = [
  "./", "index.html", "app.css", "manifest.webmanifest",
  "js/app.js", "js/api.js", "js/core/regles.js", "js/core/routes.js",
  "icons/icone.svg", "icons/icone-180.png", "icons/icone-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Réseau d'abord (toujours la dernière version), cache si pas de réseau.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copie = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))),
  );
});
