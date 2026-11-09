#!/usr/bin/env python3
"""Change chaque semaine les 5 avis du carrousel (assets/data/avis.json) à partir de outils/avis-reserve.json.

Usage : python3 -I outils/rotation-avis.py [--semaine N] [--verifier source.json]
        python3 -I outils/rotation-avis.py --self-test
La semaine ISO choisit une fenêtre glissante de 5 extraits : toute la réserve défile, sans doublon dans une semaine.
--verifier : contrôle que chaque extrait figure mot pour mot dans l'avis Google d'origine (export Windsor).
Ne touche ni à "note", ni à "nombre", ni aux autres clés de avis.json.
"""
import datetime, json, re, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
RESERVE = RACINE / "outils" / "avis-reserve.json"
AVIS = RACINE / "assets" / "data" / "avis.json"
PAR_SEMAINE = 5
TEXTE_MAX = 130


def choisir(extraits, semaine):
    n = len(extraits)
    if n < PAR_SEMAINE:
        raise ValueError(f"réserve trop petite ({n} < {PAR_SEMAINE})")
    debut = (semaine * PAR_SEMAINE) % n
    return [extraits[(debut + i) % n] for i in range(PAR_SEMAINE)]


def norm(t):
    t = t.replace("’", "'").replace(" ", " ").replace(" ", " ")
    t = re.sub(r"\s+([!?:;])", r"\1", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def verifier(extraits, source):
    commentaires = {r["review_id"]: r.get("review_comment") or "" for r in source}
    fautes = []
    for e in extraits:
        orig = commentaires.get(e["review_id"])
        if orig is None:
            fautes.append(f"{e['auteur']} : avis introuvable")
        elif norm(e["texte"]) not in norm(orig.split("(Translated by Google)")[0]):
            fautes.append(f"{e['auteur']} : extrait absent du texte d'origine")
    return fautes


def appliquer(semaine):
    reserve = json.loads(RESERVE.read_text(encoding="utf-8"))["extraits"]
    for e in reserve:
        assert len(e["texte"]) <= TEXTE_MAX, f"extrait trop long : {e['auteur']}"
    choix = choisir(reserve, semaine)
    data = json.loads(AVIS.read_text(encoding="utf-8"))
    data["avis"] = [{"auteur": e["auteur"], "etoiles": 5, "texte": e["texte"], "local_guide": e.get("local_guide", False)} for e in choix]
    AVIS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return [e["auteur"] for e in choix]


def self_test():
    ex = [{"auteur": str(i)} for i in range(12)]
    vus = set()
    for s in range(12):
        c = choisir(ex, s)
        assert len({e["auteur"] for e in c}) == PAR_SEMAINE
        vus.update(e["auteur"] for e in c)
    assert vus == {str(i) for i in range(12)}, "toute la réserve doit défiler"
    try:
        choisir(ex[:3], 0); raise AssertionError("réserve trop petite non détectée")
    except ValueError:
        pass
    src = [{"review_id": "a", "review_comment": "Super ! C’était top.\n\n(Translated by Google)\nGreat"}]
    assert verifier([{"auteur": "x", "review_id": "a", "texte": "C'était top."}], src) == []
    assert verifier([{"auteur": "x", "review_id": "a", "texte": "Great"}], src)  # la traduction ne compte pas
    print("self-test OK")


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--self-test" in a:
        self_test(); sys.exit(0)
    if "--verifier" in a:
        src = json.loads(Path(a[a.index("--verifier") + 1]).read_text(encoding="utf-8"))
        src = src["data"] if isinstance(src, dict) else src
        f = verifier(json.loads(RESERVE.read_text(encoding="utf-8"))["extraits"], src)
        print("\n".join(f) or "tous les extraits sont conformes"); sys.exit(1 if f else 0)
    s = int(a[a.index("--semaine") + 1]) if "--semaine" in a else datetime.date.today().isocalendar()[1]
    print(f"semaine {s} :", ", ".join(appliquer(s)))
