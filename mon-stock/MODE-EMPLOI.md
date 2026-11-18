# Mode d'emploi MON STOCK

Adresse : https://mon-stock-barrio.netlify.app
Code d'accès : celui que vous avez choisi (variable `MON_STOCK_CODE` dans Netlify).

## L'essentiel en trois règles

1. **Notion est la référence.** La quantité d'un produit est la somme de ses mouvements validés. Elle ne se modifie jamais à la main.
2. **Rien n'est enregistré avant CONFIRMER.** Seul l'écran vert « … enregistrée · Confirmé par Notion » garantit que l'opération est faite.
3. **NON ENREGISTRÉ veut dire : rien n'a changé.** Le stock est intact.

## Installer l'application sur l'iPhone

1. Ouvrez l'adresse dans **Safari** (pas Chrome).
2. Entrez votre code.
3. Touchez le bouton **Partager** (le carré avec une flèche vers le haut), puis **Sur l'écran d'accueil**, puis **Ajouter**.
4. L'icône MON STOCK apparaît sur l'écran d'accueil. Ouvrez l'application depuis cette icône.
5. Le code est demandé une fois dans l'application installée, puis il reste valable 30 jours.

## Consulter les stocks

- **Dans l'application** : sur l'accueil, touchez **Consulter les produits** dans BARRIO LATINO ou ÉPICERIE. Les filtres en haut affichent les produits disponibles, les stocks faibles ou les ruptures.
- **Rechercher** (accès rapide) : tapez quelques lettres du nom. Les résultats du restaurant et de l'épicerie restent dans deux groupes séparés.
- **Dans Notion** : page GESTION DES STOCKS. Le tableau de bord en bas de page liste les ruptures, les stocks faibles et les derniers mouvements.

## Ajouter un produit (dans Notion)

1. Ouvrez la bonne base : **STOCK RESTAURANT** ou **STOCK ÉPICERIE**.
2. Ajoutez une ligne : nom, catégorie, unité de mesure.
3. Remplissez le **stock minimum** pour être prévenu avant la rupture.
4. Le produit apparaît dans l'application à 0. Faites une **entrée** avec le motif « Inventaire initial » pour indiquer la quantité réelle.

Pour renommer un produit, changez son nom dans Notion. L'application suit à la prochaine ouverture de l'écran.

## Enregistrer une entrée (livraison, achat)

1. Accueil, puis **Ajouter une entrée** dans le bon espace.
2. Choisissez le produit. Le stock actuel s'affiche.
3. Tapez la quantité reçue, ajoutez un commentaire si besoin (« livraison Métro »).
4. **CONTINUER**, vérifiez le récapitulatif, puis **CONFIRMER L'ENTRÉE**.

## Enregistrer une sortie

1. Accueil, puis **Enregistrer une sortie** dans le bon espace.
2. Choisissez le produit, tapez la quantité à retirer.
3. Un avertissement orange ou rouge prévient si le produit passe en stock faible ou en rupture.
4. **CONTINUER**, vérifiez, puis **CONFIRMER LA SORTIE**.

Une sortie plus grande que le stock est refusée.

## Corriger une quantité (inventaire, casse, erreur)

1. Ouvrez le produit (Consulter les produits, puis le produit), puis **Corriger**.
2. Tapez la quantité **réellement comptée** et le **motif** (obligatoire).
3. Le récapitulatif montre l'ancienne quantité, la nouvelle et la différence.
4. **CONFIRMER LA CORRECTION**.

Pour annuler une erreur de saisie, faites une correction vers la bonne quantité. L'ancien mouvement reste dans l'historique.

## Consulter l'historique

Accueil, puis **Historique**. Filtrez par activité (Barrio Latino, Épicerie), par type (entrées, sorties, corrections) et par période. Dans Notion, la base HISTORIQUE DES MOUVEMENTS a les mêmes onglets.

## Repérer les stocks faibles

- 🟢 **Suffisant** : au-dessus du stock minimum.
- 🟠 **Stock faible** : au stock minimum ou en dessous.
- 🔴 **Rupture** : zéro.

Le chiffre sur le bouton **Voir les alertes** donne le nombre de produits concernés. Un produit sans stock minimum ne passe jamais en orange.

## En cas de problème

| Ce que vous voyez | Que faire |
|---|---|
| NON ENREGISTRÉ, pas de connexion | Vérifiez le réseau. En mode Avion, le Wi-Fi peut rester allumé. Touchez **Réessayer** : un envoi déjà passé est reconnu, jamais compté deux fois. |
| « Le stock a changé entre-temps » | Le stock a bougé depuis l'écran précédent. Relisez la nouvelle quantité et confirmez à nouveau. |
| Un point dans **Contrôle** | Notez le message et signalez-le. Ne supprimez rien. |
| Code oublié ou à changer | Netlify, puis Project configuration, Environment variables, `MON_STOCK_CODE`. Ensuite Deploys, Trigger deploy. |

## À ne jamais faire dans Notion

- Modifier la colonne « Quantité disponible » (Notion la calcule).
- Supprimer un produit qui a des mouvements : cochez plutôt **Archivé**.
- Déplacer un produit d'une base à l'autre : créez une fiche dans chaque base.
- Supprimer un mouvement de l'historique.
