#!/usr/bin/env python3
"""Met à jour la note et le nombre d'avis Google partout sur le site.

Usage :
    python3 outils/maj-avis-google.py --note 4.8 --nombre 299

Endroits mis à jour (ensemble, sinon le site se contredit) :
- assets/data/avis.json : "note" et "nombre" (lus au chargement par main.js)
- index.html : valeurs affichées avant le chargement du JSON (data-note, data-nb-avis),
  meta description, og:description (aperçu de partage) et JSON-LD aggregateRating (Google).

Ne touche à rien d'autre. Affiche « aucun changement » si les chiffres sont déjà à jour.
"""
import argparse
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
AVIS = RACINE / "assets/data/avis.json"
INDEX = RACINE / "index.html"


def remplacer(texte, motif, remplacement, attendu, nom):
    nouveau, n = re.subn(motif, remplacement, texte)
    if n != attendu:
        sys.exit(f"ERREUR : {nom} trouvé {n} fois au lieu de {attendu}. Rien n'a été écrit.")
    return nouveau


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--note", type=float, required=True)
    p.add_argument("--nombre", type=int, required=True)
    a = p.parse_args()
    if not (1.0 <= a.note <= 5.0) or a.nombre < 1:
        sys.exit("ERREUR : valeurs hors limites.")

    note_fr = f"{a.note:.1f}".replace(".", ",")
    note_en = f"{a.note:.1f}"

    avis = AVIS.read_text(encoding="utf-8")
    avis2 = remplacer(avis, r'("note":\s*)[0-9.]+', rf"\g<1>{note_en}", 1, "avis.json note")
    avis2 = remplacer(avis2, r'("nombre":\s*)\d+', rf"\g<1>{a.nombre}", 1, "avis.json nombre")

    html = INDEX.read_text(encoding="utf-8")
    h = remplacer(html, r"(<span data-note>)[0-9,]+(</span>)", rf"\g<1>{note_fr}\g<2>", 2, "data-note")
    h = remplacer(h, r"(<span data-nb-avis>)\d+(</span>)", rf"\g<1>{a.nombre}\g<2>", 2, "data-nb-avis")
    h = remplacer(h, r"(Noté )[0-9,]+(/5 sur Google)", rf"\g<1>{note_fr}\g<2>", 1, "meta description")
    h = remplacer(h, r"[0-9,]+(/5 sur Google avec )\d+( avis)", rf"{note_fr}\g<1>{a.nombre}\g<2>", 1, "og:description")
    h = remplacer(h, r'("ratingValue":\s*")[0-9.]+(")', rf"\g<1>{note_en}\g<2>", 1, "JSON-LD ratingValue")
    h = remplacer(h, r'("reviewCount":\s*")\d+(")', rf"\g<1>{a.nombre}\g<2>", 1, "JSON-LD reviewCount")

    if avis2 == avis and h == html:
        print(f"aucun changement ({note_fr}/5, {a.nombre} avis)")
        return
    AVIS.write_text(avis2, encoding="utf-8")
    INDEX.write_text(h, encoding="utf-8")
    print(f"mis à jour : {note_fr}/5, {a.nombre} avis")


if __name__ == "__main__":
    main()
