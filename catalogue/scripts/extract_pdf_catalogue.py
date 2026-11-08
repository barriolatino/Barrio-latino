"""Extrait les fiches produits d'un catalogue fournisseur PDF (mise en page Impex).

Pour chaque photo produit : l'image détourée (PNG avec transparence) et le texte
placé juste en dessous (nom, format/conditionnement/prix, référence).

Usage : python3 scripts/extract_pdf_catalogue.py catalogue.pdf dossier_sortie/

Sorties :
  dossier_sortie/images/<ref>.png
  dossier_sortie/produits.json   (toutes les données lues, y compris le prix fournisseur)

Les prix fournisseur sont des prix d'achat : ils ne doivent jamais être publiés
tels quels. L'import dans le catalogue se fait avec vos propres prix.
"""

import json
import re
import sys
from pathlib import Path

import pymupdf

REF_RE = re.compile(r"Ref:\s*(\d+)")
INFO_RE = re.compile(r"€|\\bCj\\b|\\bPq\\b|\\bDs\\b|\\d\\s*g\\.|\\bkg\\b|Precio", re.I)
PRICE_RE = re.compile(r"(\d+[.,]\d{1,2}|\d+[.,]?)\s*€")


def parse_info(info: str) -> dict:
    out: dict = {"raw": info}
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g)\b", info, re.I)
    if m:
        v = float(m.group(1).replace(",", "."))
        out["netWeightG"] = int(round(v * 1000)) if m.group(2).lower() == "kg" else int(v)
    if re.search(r"precio por kg", info, re.I):
        out["saleUnit"] = "KG"
    m = re.search(r"(Pq|Ds)\s*x\s*(\d+)\s*u", info, re.I)
    if m:
        out["unitCount"] = int(m.group(2))
        out["packagingKind"] = "Paquet" if m.group(1).lower() == "pq" else "Sachet"
    m = re.search(r"Cj\s*x\s*(\d+)", info, re.I)
    if m:
        out["caseQuantity"] = int(m.group(1))
    m = PRICE_RE.search(info)
    if m:
        out["supplierPrice"] = float(m.group(1).replace(",", ".").rstrip("."))
    return out


def page_title(page) -> str:
    for b in page.get_text("dict")["blocks"]:
        for line in b.get("lines", []):
            for span in line["spans"]:
                if span["bbox"][1] < 120 and span["size"] > 20 and span["text"].strip():
                    return span["text"].strip()
    return ""


def main(pdf_path: str, out_dir: str):
    doc = pymupdf.open(pdf_path)
    out = Path(out_dir)
    (out / "images").mkdir(parents=True, exist_ok=True)
    products = []
    for pno, page in enumerate(doc, start=1):
        text = page.get_text()
        if "Ref:" not in text:
            continue  # couverture, pages publicitaires
        section = page_title(page)
        # La page est une grille de 4 colonnes. On part de chaque « Ref: » : les
        # lignes juste au-dessus donnent le nom et le format, la photo est celle
        # de la même colonne placée au-dessus du nom.
        col_w = page.rect.width / 4
        col_of = lambda x: min(3, int(x // col_w))
        images = [i for i in page.get_image_info(xrefs=True) if i["bbox"][1] >= 40 and (i["bbox"][2] - i["bbox"][0]) >= 40]
        words = page.get_text("words")
        seen: dict = {}
        for rw in [w for w in words if w[4] == "Ref:"]:
            col = col_of((rw[0] + rw[2]) / 2)
            ref_y = rw[1]
            ref_words = [w for w in words if abs(w[1] - ref_y) < 3 and col_of((w[0] + w[2]) / 2) == col]
            ref_m = REF_RE.search(" ".join(w[4] for w in sorted(ref_words, key=lambda w: w[0])))
            if not ref_m:
                continue
            ref = ref_m.group(1)
            cell = [w for w in words if col_of((w[0] + w[2]) / 2) == col and ref_y - 48 <= w[1] < ref_y - 2]
            rows: dict = {}
            for w in sorted(cell, key=lambda w: (w[1], w[0])):
                key = next((k for k in rows if abs(k - w[1]) < 4), w[1])
                rows.setdefault(key, []).append(w)
            lines_txt = [" ".join(x[4] for x in sorted(v, key=lambda x: x[0])) for _, v in sorted(rows.items())]
            # Une ligne de nom d'une fiche précédente ne peut pas contenir « Ref: »
            names = [t for t in lines_txt if not INFO_RE.search(t) and "Ref:" not in t]
            infos = [t for t in lines_txt if INFO_RE.search(t)]
            name = re.sub(r"\s+", " ", " ".join(names)).replace("- ", "-").strip()
            info_text = " ".join(infos).strip()
            top = min([w[1] for w in cell], default=ref_y)
            candidates = [
                i for i in images
                if col_of((i["bbox"][0] + i["bbox"][2]) / 2) == col and (i["bbox"][1] + i["bbox"][3]) / 2 < top
            ]
            if not candidates:
                continue
            info = max(candidates, key=lambda i: (i["bbox"][1] + i["bbox"][3]) / 2)
            x0, y0, x1, y1 = info["bbox"]
            if top - y1 > 80:
                continue  # trop loin : pas la photo de cette fiche
            area = (x1 - x0) * (y1 - y0)
            if seen.get(ref, 0) >= area:
                continue
            seen[ref] = area
            xref = info["xref"]
            pix = pymupdf.Pixmap(doc, xref)
            smask = doc.extract_image(xref).get("smask")
            if smask:
                pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
            if pix.n - pix.alpha > 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            file = f"images/{ref}.png" if ref != "0" else f"images/p{pno}-{xref}.png"
            pix.save(out / file)
            products[:] = [p for p in products if not (p["reference"] == ref and p["page"] == pno)]
            products.append({"page": pno, "section": section, "name": name, "reference": ref, "info": parse_info(info_text), "image": file, "width": pix.width, "height": pix.height})
    (out / "produits.json").write_text(json.dumps(products, ensure_ascii=False, indent=1))
    print(f"{len(products)} produits extraits dans {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
