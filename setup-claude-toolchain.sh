#!/usr/bin/env bash
# Réinstalle la chaîne d'outils Claude Code : find-skill, superpowers,
# claude-mem, impeccable, task-observer.
# Idempotent : relançable sans risque. Ne touche pas à launcher-settings.json.
set -uo pipefail

export PATH="$HOME/.bun/bin:$PATH"
log() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()  { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
ko()  { printf '  \033[0;31m✗\033[0m %s\n' "$1"; }

log "Sauvegarde de la configuration existante"
BK="$HOME/.claude-backup-$(date +%Y%m%d-%H%M%S)"
if [ -d "$HOME/.claude" ]; then
  cp -a "$HOME/.claude" "$BK" && ok "Sauvegarde : $BK"
else
  ok "Pas de ~/.claude préexistant"
fi

log "Marketplaces officiels"
for m in obra/superpowers-marketplace pbakaus/impeccable \
         rebelytics/one-skill-to-rule-them-all thedotmack/claude-mem; do
  if claude plugin marketplace add "$m" >/dev/null 2>&1; then ok "$m"; else ok "$m (déjà présent)"; fi
done

log "Plugins"
for p in superpowers@superpowers-marketplace \
         task-observer@one-skill-to-rule-them-all \
         impeccable@impeccable \
         claude-mem@thedotmack; do
  if claude plugin install "$p" >/dev/null 2>&1; then ok "$p"; else ok "$p (déjà installé)"; fi
done

log "find-skill (hors ~/.claude/skills pour éviter un skill dupliqué)"
SRC="$HOME/.claude/find-skill-src"
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" pull --quiet 2>/dev/null && ok "source mise à jour"
else
  rm -rf "$SRC"
  git clone --quiet --depth 1 https://github.com/fockus/claude-skill-find-skill.git "$SRC" && ok "source clonée"
fi
# Le dépôt contient un SKILL.md : le garder hors de ~/.claude/skills/ empêche
# l'enregistrement d'un doublon à côté du skill installé "find-skill".
if [ -d "$SRC" ]; then
  ( cd "$SRC" && printf '\ny\n' | ./install.sh --target claude >/dev/null 2>&1 ) \
    && ok "skill find-skill + commande install-skill installés" \
    || ko "échec install.sh (relancer manuellement : cd $SRC && ./install.sh --target claude)"
fi

log "Runtime claude-mem (worker local, sans Docker, sans cloud sync)"
npx --yes claude-mem@latest install --ide claude-code --provider claude --runtime worker >/dev/null 2>&1 \
  && ok "runtime installé" || ko "échec runtime claude-mem"
npx --yes claude-mem@latest telemetry disable >/dev/null 2>&1 && ok "télémétrie désactivée"
npx --yes claude-mem@latest start >/dev/null 2>&1 && ok "worker démarré"

log "Vérification"
claude plugin list 2>/dev/null | grep -E "^  >" || ko "aucun plugin listé"
[ -f "$HOME/.claude/skills/find-skill/SKILL.md" ] && ok "find-skill présent" || ko "find-skill absent"
npx --yes claude-mem@latest doctor 2>/dev/null | tail -8

printf '\n\033[0;32mTerminé.\033[0m Redémarrer Claude Code pour activer les hooks.\n'
