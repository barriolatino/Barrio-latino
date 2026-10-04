"""Erreurs compréhensibles par un utilisateur non technicien.

Chaque erreur porte un message en français et, si possible, une piste de
résolution. Les détails techniques (sortie FFmpeg) vont dans le journal.
"""


class StudioError(Exception):
    def __init__(self, message: str, hint: str | None = None, details: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.details = details

    def __str__(self) -> str:
        text = self.message
        if self.hint:
            text += f"\n  → {self.hint}"
        return text


class MediaError(StudioError):
    """Fichier illisible, corrompu ou sans flux exploitable."""


class FFmpegError(StudioError):
    """Échec d'une commande FFmpeg/FFprobe."""


class ProjectError(StudioError):
    """Projet introuvable, incohérent ou étape manquante."""


class ConfigError(StudioError):
    """Profil, preset ou paramètre inconnu."""
