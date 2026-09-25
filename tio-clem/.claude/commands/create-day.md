---
description: Tio Clem — produit entièrement la publication d'un jour du calendrier
argument-hint: <numéro du jour 1-30>
---
> Chemins relatifs à la racine du projet Tio Clem (le dossier qui contient `config/brand.json`). Dans le dépôt Barrio-latino, fais d'abord `cd tio-clem`.

Produis la publication Tio Clem du **jour $ARGUMENTS**, de la recherche à l'export.

Lis d'abord `PLAYBOOK.md` et respecte-le à la lettre.

1. `python3 tools/factory.py calendar` : récupère sujet, format, catégorie et date du jour $ARGUMENTS. Si le jour dépasse le calendrier, prends l'idée donnée par `python3 tools/factory.py next`.
2. **Anti-répétition, avant d'écrire** : `python3 tools/factory.py draft NN` crée le squelette `content/posts/day-NN.json` et affiche le pré-contrôle (sujet, angle, format face aux publications passées). Un `[!]` bloque : choisis un autre angle (voir les `angles_reserves` des recherches existantes et `content/angles.json`) et vérifie-le avec `python3 tools/factory.py repeat-check --title "…" --theme … --angle … --format …` avant d'aller plus loin.
3. **Recherche** (obligatoire) : WebSearch + `mcp__Firecrawl__firecrawl_scrape` pour lire les pages (WebFetch est souvent bloqué). Sources dans l'ordre de `config/source-policy.json`. Écris `research/<slug>.json` au format de `research/ceviche.json` : faits avec statut (FAIT ÉTABLI / HYPOTHÈSE / LÉGENDE / INTERPRÉTATION), confiance, sources (`lu` : `complet` ou `extrait`), informations écartées et pourquoi. Puis `python3 tools/factory.py research-check <slug>` jusqu'à zéro erreur. N'invente jamais une source ni une URL.
4. **Écriture** : remplace tous les « À ÉCRIRE » du squelette. Structure HOOK → PROMESSE → INFORMATION → EXEMPLE / SURPRISE → CONCLUSION → CTA ; 5 hooks de types différents (`hook_types`) et choix justifié ; SEO (`primary_keyword`, `secondary_keywords`, `search_phrase`) ; cover 3 à 7 mots ; description ; 5 à 8 hashtags ; `human_checks`. Chaque scène d'information cite ses faits (`facts`). Phrases courtes, écrites pour être dites.
5. **Vérification du script** : `python3 tools/factory.py lint NN` jusqu'à zéro erreur ; traite aussi les avertissements quand c'est possible.
6. **Rendu + contrôle** : `python3 tools/factory.py build NN`. Si le statut est `NEEDS_REVIEW`, corrige le JSON (ou la recherche) et relance jusqu'à `READY_TO_PUBLISH`. Relis toi-même orthographe, accords et naturel à l'oral : le contrôle automatique ne remplace pas une relecture.
7. Regarde la cover et 2 ou 3 images de la vidéo (extrais-les avec ffmpeg) pour vérifier le rendu.
8. Ne publie rien sur TikTok. Termine en listant : ce qui a été créé, les sources utilisées, les fichiers réellement produits (vérifie avec `ls`), et les points à vérifier par un humain.
