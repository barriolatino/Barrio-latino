# Visuels

Pour chaque scène, slide ou cover, dans cet ordre :

1. **ta photo** : `assets/images/posts/day-NN/scene03.jpg` (ou `slide02.jpg`, `cover.jpg`) ;
2. **image sourcée (Mode A)** : `python3 tools/factory.py asset-add photo.jpg --day 5 --unit scene03
   --license "CC BY-SA 4.0" --source "Wikimedia Commons" --url … --author … --license-url …`.
   Licences acceptées : photo perso, CC0, domaine public, CC BY, CC BY-SA, Unsplash, Pexels.
   NC et ND sont refusées (le compte peut être monétisé, et l'image est recadrée et annotée).
   Les crédits obligatoires vont dans le README de la publication ;
3. **image générée (Mode B)** : seulement si la scène a `"asset_type": "generated"` et que
   `IMAGE_PROVIDER` est configuré. Le prompt (`prompts.py`) impose un Pérou réaliste, sans
   texte, sans drapeau ajouté, sans cliché. Image et prompt sont gardés dans
   `assets/images/generated/day-NN/` ;
4. **carte graphique Tio Clem** (par défaut, aucun coût).

| `IMAGE_PROVIDER` | Testé en réel |
|---|---|
| `none` | oui |
| `mock` | oui, **tests uniquement** (image marquée « MOCK ») |
| `openai` (`/v1/images/generations`, 1024x1536) | non : API injoignable pendant le développement |

Chaque rendu écrit `assets.json` (type, source, licence ou prompt de chaque visuel) et le
contrôle qualité vérifie licences, prompts et absence de MOCK.
