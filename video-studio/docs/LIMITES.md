# Limites connues (état réel)

Ce document liste honnêtement ce qui n'est pas fait, ou fait de manière approximative.

## Compréhension du contenu

- Le système **ne comprend pas le sens** des images : pas de reconnaissance d'objets, de visages,
  d'émotions ou de produits. Les « moments forts » sont estimés par le mouvement, l'énergie sonore et
  la qualité technique. « Mets en valeur le produit » augmente seulement la place des plans
  d'illustration.
- Le sujet pour le recadrage vertical est estimé par le mouvement et les détails : quand la
  confiance est faible, le système choisit l'arrière-plan flouté plutôt que de risquer de couper
  l'essentiel. Tout recadrage automatique est signalé « à vérifier ».
- Le choix du profil automatique est une heuristique simple (parole / orientation / mouvement).

## Parole

- Pas de **diarisation** (qui parle quand) : les intervenants sont nommés par rush (`--speaker`).
- pocketsphinx (anglais) fait des erreurs fréquentes ; faster-whisper nécessite un modèle local
  (bloqué par le réseau dans l'environnement de développement : non testé ici sur de la vraie
  parole française — l'adaptateur est écrit mais n'a pas pu être exécuté).
- Pas de ponctuation ajoutée sur une sortie pocketsphinx (seulement une majuscule) ; pas de
  traduction.
- La parole est détectée par l'énergie et la transcription : une musique forte dans un rush peut être
  prise pour de l'« activité sonore » (on ne coupe alors jamais à l'intérieur, par prudence).

## Image et habillage

- Correction couleur automatique simple (exposition, dominante, profils), pas un étalonnage plan
  par plan ni une correspondance de couleur entre caméras au sens professionnel.
- Pas de stabilisation (les tremblements sont seulement détectés et pénalisés).
- Bibliothèque d'habillage limitée à : titre, identification d'intervenant, texte de fin, fondus,
  filigrane. Non faits : flèches, encadrements, cartes, graphiques, barres de progression, masques,
  recadrages animés, arrêt sur image, flou de mouvement, logo incrusté. Remotion n'est pas intégré.
- Un seul plan de coupe par plan parlé.

## Projet

- Pas d'export de projet ouvrable dans Premiere/DaVinci (EDL/FCPXML) : la timeline JSON est le
  projet modifiable.
- Interface web volontairement simple, sans aperçu image par image ni édition de timeline à la souris.
- La validation humaine est un statut enregistré : elle n'empêche pas techniquement de copier un
  export non validé.

## Tests

Les tests utilisent des médias synthétiques (images de synthèse, voix Flite, musique générée), faute
de rushs réels dans l'environnement. Ils vérifient la chaîne de bout en bout sur des fichiers
réellement rendus, mais pas la qualité esthétique sur de vraies prises de vue : un essai sur vos
propres rushs reste nécessaire.
