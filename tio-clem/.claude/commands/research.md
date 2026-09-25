---
description: Tio Clem — effectue uniquement la recherche documentaire d'un sujet
argument-hint: <sujet>
---
> Chemins relatifs à la racine du projet Tio Clem (le dossier qui contient `config/brand.json`). Dans le dépôt Barrio-latino, fais d'abord `cd tio-clem`.

Effectue **uniquement la recherche** pour le sujet : **$ARGUMENTS**. N'écris ni script ni visuel.

Suis la section 3 de `PLAYBOOK.md` : sources prioritaires, comparaison, désaccords, informations écartées et pourquoi. Lis les pages avec `mcp__Firecrawl__firecrawl_scrape` (WebFetch est souvent bloqué). Pour l'histoire, distingue fait établi, hypothèse, légende et interprétation.

Écris `research/<slug>.json` au format de `research/ceviche.json` (chaque source a `lu` : `complet` si la page a été lue, `extrait` si seulement vue dans un moteur de recherche), valide-la avec `python3 tools/factory.py research-check <slug>` jusqu'à zéro erreur, puis résume : faits retenus (avec niveau de confiance), sources, désaccords, informations écartées, angles possibles pour de futurs posts.
