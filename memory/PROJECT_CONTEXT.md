# Barrio Latino — site vitrine

Site statique publié par GitHub Pages depuis `main` : https://barriolatino.github.io/Barrio-latino/. Toute l'architecture et les contraintes (budget de poids, couleurs « deep », note Google à 6 endroits, horaires à 3 endroits, galeries, vignettes) sont dans `../CLAUDE.md` : c'est la référence, ce fichier ne la recopie pas.

- Pile : HTML/CSS/JS sans build ; données dans `assets/data/*.json` ; outils Python dans `outils/`.
- Sous-projet séparé : `catalogue/` (Next.js, Vercel), voir `catalogue/README.md`.
- **Dépôt public** : ce dossier `memory/` est publié avec le site. Jamais de nom de client, de téléphone, d'identifiant de compte ni de secret ici ; le détail privé est dans `claude-studio/memory/`.
