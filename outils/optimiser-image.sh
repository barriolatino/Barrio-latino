#!/usr/bin/env bash
# Prépare une photo pour le site : produit un WebP (servi en priorité)
# et un JPG de secours, tous deux dans assets/img/.
#
#   ./outils/optimiser-image.sh <photo-source> <dossier/nom> [largeur-max]
#
# Exemples :
#   ./outils/optimiser-image.sh ~/photos/ceviche.jpg plats/ceviche
#   ./outils/optimiser-image.sh ~/photos/salle.jpg salle/salle-vue-generale 1600
#
# Dépendances : cwebp et dwebp (paquet « webp »), cjpeg (paquet
# « libjpeg-turbo-progs »). Sur macOS : brew install webp jpeg-turbo
set -euo pipefail

src=${1:?photo source manquante}
out=${2:?nom de sortie manquant (ex. plats/ceviche)}
max=${3:-1600}

for outil in cwebp dwebp cjpeg; do
  command -v "$outil" >/dev/null || { echo "Outil manquant : $outil" >&2; exit 1; }
done

racine=$(cd "$(dirname "$0")/.." && pwd)
dest="$racine/assets/img/$out"
mkdir -p "$(dirname "$dest")"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# -resize L 0 conserve les proportions et ne fait que réduire si besoin.
cwebp -quiet -q 80 -m 6 -sharp_yuv -resize "$max" 0 "$src" -o "$dest.webp"
cwebp -quiet -lossless      -resize "$max" 0 "$src" -o "$tmp/x.webp"
dwebp -quiet "$tmp/x.webp" -ppm -o "$tmp/x.ppm"
cjpeg -quality 80 -optimize -progressive "$tmp/x.ppm" > "$dest.jpg"

printf 'Créé :\n  %-46s %6s\n  %-46s %6s\n' \
  "assets/img/$out.webp" "$(du -h "$dest.webp" | cut -f1)" \
  "assets/img/$out.jpg"  "$(du -h "$dest.jpg"  | cut -f1)"
echo
echo "Pensez à mettre à jour width/height et alt dans index.html."
