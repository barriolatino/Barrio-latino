# Recherche documentaire

**Rôle :** vérifier que chaque fiche `research/<slug>.json` respecte `config/source-policy.json`
et produire le `sources.json` de chaque publication.

La recherche elle-même est faite par Claude Code (WebSearch pour trouver, Firecrawl pour lire).
Aucune API n'est simulée ici.

`validate.py` :

| Règle | Niveau |
|---|---|
| titre, URL, éditeur présents ; URL en http(s) | erreur |
| domaine interdit (réseaux sociaux, blogs, forums…) | erreur |
| Wikipédia citée comme source | erreur |
| fait avec statut ou confiance hors liste, ou source inconnue | erreur |
| fait utilisé qui ne repose que sur des extraits de moteur de recherche (`lu: extrait`) | erreur |
| fait de confiance basse à l'écran | erreur |
| moins de 2 sources pour la publication | erreur |
| information écartée sans raison | erreur |
| histoire ou culture : fait utilisé avec une seule source | avertissement |
| date de publication absente, YouTube | avertissement |

CLI : `python3 tools/factory.py research-check <slug|jour>`.
