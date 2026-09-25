#!/usr/bin/env bash
# Extrait Tio Clem du dépôt Barrio-latino vers un dépôt dédié, historique compris.
#
#   bash tools/move-to-own-repo.sh <dossier-cible> [url-du-nouveau-dépôt] [branche-source]
#
# - Travaille sur un clone : le dépôt Barrio-latino n'est jamais modifié.
# - Garde l'historique de tioclem/ puis tio-clem/, remis à la racine.
# - Lance les tests (tools/check.py) dans le nouveau dépôt avant tout push.
# - Sans URL : prépare seulement le dépôt local. Avec URL : pousse sur la branche main.
set -euo pipefail

TARGET=${1:?usage: move-to-own-repo.sh <dossier-cible> [url] [branche]}
REMOTE_URL=${2:-}
SRC_REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
BRANCH=${3:-$(git -C "$SRC_REPO" rev-parse --abbrev-ref HEAD)}

command -v git-filter-repo >/dev/null || python3 -m pip install --quiet git-filter-repo
[ -e "$TARGET" ] && { echo "✗ $TARGET existe déjà"; exit 1; }

echo "==> Clone de $SRC_REPO (branche $BRANCH)"
git clone --quiet --no-local --branch "$BRANCH" "$SRC_REPO" "$TARGET"

echo "==> Filtrage : seul le projet Tio Clem est gardé, remis à la racine"
git -C "$TARGET" filter-repo --quiet --force \
  --path tioclem/ --path tio-clem/ \
  --path-rename tioclem/: --path-rename tio-clem/:
git -C "$TARGET" branch -M main

echo "==> Tests dans le nouveau dépôt"
( cd "$TARGET" && python3 tools/check.py )

echo "==> Historique conservé : $(git -C "$TARGET" rev-list --count HEAD) commits"
if [ -n "$REMOTE_URL" ]; then
  git -C "$TARGET" remote add origin "$REMOTE_URL"
  git -C "$TARGET" push -u origin main
  echo "✓ Poussé sur $REMOTE_URL"
else
  echo "✓ Dépôt prêt dans $TARGET (aucun push : ajoute une URL pour publier)"
fi
