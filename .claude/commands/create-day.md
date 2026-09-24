---
description: Tio Clem — produit entièrement la publication d'un jour du calendrier
argument-hint: <numéro du jour 1-30>
---
Produis la publication Tio Clem du **jour $ARGUMENTS**, de la recherche à l'export.

Lis d'abord `tioclem/PLAYBOOK.md` et respecte-le à la lettre.

1. `python3 tioclem/factory.py calendar` : récupère sujet, format, catégorie et date du jour $ARGUMENTS.
2. Lis `tioclem/content/published.json` : ne reprends ni un sujet, ni un hook, ni un angle déjà utilisé. Si le thème est déjà apparu, choisis un angle différent (voir les `angles_reserves` des recherches existantes).
3. **Recherche** (obligatoire) : WebSearch + `mcp__Firecrawl__firecrawl_scrape` pour lire les pages (WebFetch est souvent bloqué). Sources prioritaires : institutions, organismes officiels péruviens, musées, universités, UNESCO. Écris `tioclem/research/<slug>.json` au format de `tioclem/research/ceviche.json` : faits avec statut (FAIT ÉTABLI / HYPOTHÈSE / LÉGENDE / INTERPRÉTATION), confiance, sources, informations écartées et pourquoi.
4. **Écriture** : crée `tioclem/content/posts/day-NN.json` (NN sur deux chiffres) au format de `day-01.json` : promesse, 5 hooks de structures différentes + choix justifié, émotion, interaction, SEO, scènes (vidéo) ou slides (carrousel), CTA, question, cover (3 à 7 mots), description, 5 à 8 hashtags, `human_checks`. Chaque scène info/surprise cite ses faits (`facts`).
5. **Rendu + contrôle** : `python3 tioclem/factory.py build NN`. Si le statut est `NEEDS_REVIEW`, corrige le JSON (ou la recherche) et relance jusqu'à `READY_TO_PUBLISH`. Relis toi-même orthographe, accords et naturel à l'oral : le contrôle automatique ne remplace pas une relecture.
6. Regarde la cover et 2 ou 3 images de la vidéo (extrais-les avec ffmpeg) pour vérifier le rendu.
7. Ne publie rien sur TikTok. Termine en listant : ce qui a été créé, les sources utilisées, les fichiers réellement produits (vérifie avec `ls`), et les points à vérifier par un humain.
