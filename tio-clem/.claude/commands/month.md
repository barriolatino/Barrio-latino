---
description: Tio Clem — produit les 30 jours du calendrier
---
> Chemins relatifs à la racine du projet Tio Clem (le dossier qui contient `config/brand.json`). Dans le dépôt Barrio-latino, fais d'abord `cd tio-clem`.

Mode « 30 jours ». Lis `PLAYBOOK.md`, puis :

1. `python3 tools/factory.py calendar` : lis le calendrier.
2. Repère les contenus déjà produits (`READY_TO_PUBLISH`) : ne les refais pas.
3. Pour chaque jour restant, dans l'ordre, suis `.claude/commands/create-day.md` : recherche, scripts, visuels, vidéos ou carrousels, covers, descriptions, hashtags, contrôle qualité.
4. Toutes les 5 publications, relis `content/published.json` et vérifie la variété (hooks, angles, émotions, palettes, CTA).
5. À la fin : `python3 tools/factory.py review all`, puis `python3 tools/factory.py export`.

La qualité passe avant la vitesse : si une recherche ne donne pas assez de sources fiables, marque le jour comme bloqué et explique pourquoi plutôt que de produire un contenu douteux. Termine par un tableau des 30 jours (statut, dossier, points à vérifier).
