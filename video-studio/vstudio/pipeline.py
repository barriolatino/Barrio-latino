"""Orchestration des étapes, reprise après échec et corrections automatiques.

Chaque étape enregistre son état dans project.json (« en cours », « terminé », « échec »).
Relancer une commande reprend là où le travail s'est arrêté : analyses et segments
déjà calculés sont réutilisés, les fichiers temporaires d'un rendu interrompu sont
nettoyés et recalculés.
"""

from __future__ import annotations

import copy
import json
import traceback
from pathlib import Path

from . import config, planner, qc, render
from .analysis import runner
from .errors import ProjectError, StudioError
from .ingest import ingest
from .project import Project, atomic_write_text, stable_hash

MAX_FIX_ROUNDS = 2


def _step(project: Project, name: str, key: str, fn):
    project.mark_step(name, "en cours", key)
    try:
        out = fn()
    except StudioError as e:
        project.mark_step(name, "échec", key, e.message)
        project.journal(f"ÉCHEC de l'étape {name} : {e.message}" + (f"\n{e.details}" if e.details else ""))
        raise
    except Exception as e:  # erreur inattendue : trace complète dans le journal
        project.mark_step(name, "échec", key, str(e))
        project.log.debug(traceback.format_exc())
        raise StudioError(f"Erreur inattendue pendant l'étape « {name} » : {e}",
                          hint="Le détail technique est dans journal.log. Relancez la commande pour reprendre.") from e
    project.mark_step(name, "terminé", key)
    return out


def step_import(project: Project, sources: list) -> list[dict]:
    return _step(project, "import", stable_hash(sources), lambda: ingest(project, sources))


def step_analyze(project: Project, force: bool = False) -> dict:
    key = stable_hash([r["fingerprint"] for r in project.usable_rushes()] + [project.settings.get("lang")])
    if not force and project.step_key_matches("analyse", key) and project.path("analysis", "synthese.json").exists():
        project.journal("Analyse : déjà faite pour ces rushs (reprise)")
        return json.loads(project.path("analysis", "synthese.json").read_text(encoding="utf-8"))
    return _step(project, "analyse", key, lambda: runner.analyze(project, force=force))


def plan_key(project: Project) -> str:
    s = project.settings
    return stable_hash([[r["fingerprint"] for r in project.usable_rushes()],
                        {k: s.get(k) for k in ("profile", "presets", "target_duration", "music", "captions",
                                               "subtitle_scale", "overrides", "title", "end_text", "speakers", "lang")}])


def step_plan(project: Project, force: bool = False) -> dict:
    summary = step_analyze(project)
    key = plan_key(project)
    if not force and project.step_key_matches("plan", key) and project.state["timeline_versions"]:
        tl = project.load_timeline()
        project.journal(f"Plan : version v{tl['version']:03d} toujours valable (reprise)")
        return tl

    def do():
        tl = planner.build_plan(project, summary)
        tl["plan_key"] = key
        project.save_timeline(tl)
        md = planner.write_plan_md(project, tl)
        project.journal(f"Plan de montage v{tl['version']:03d} : {len(tl['clips'])} plans, "
                        f"{tl['expected_duration']:.1f} s — {md.relative_to(project.root)}")
        for d in tl["decisions"]:
            project.journal(f"    · {d}")
        return tl
    return _step(project, "plan", key, do)


def derive_for_preset(project: Project, timeline: dict, preset_name: str) -> dict:
    """Adapte une timeline à un autre format (dimensions, recadrage, style de sous-titres)."""
    if preset_name == timeline["preset"]:
        return timeline
    preset = config.export_preset(preset_name)
    tl = copy.deepcopy(timeline)
    main = max(project.usable_rushes(), key=lambda r: r["info"]["duration"])
    tl["width"] = preset["width"] or main["info"]["display_width"]
    tl["height"] = preset["height"] or main["info"]["display_height"]
    tl["fps"] = preset["fps"] or timeline["fps"]
    tl["preset"] = preset_name
    if not timeline["params"].get("subtitle_style"):
        tl["subtitle_style"] = preset["subtitle_style"]
    flags = []
    for c in tl["clips"]:
        c["flags"] = [f for f in c.get("flags", []) if not f.startswith("recadrage automatique")]
        m, cx, f = planner.reframe_mode(project.rush(c["rush"]), tl["width"], tl["height"], tl["params"],
                                        c.get("subject_x", 0.5), c.get("subject_confidence", 0))
        c["reframe"], c["crop_x"] = m, round(cx, 3)
        c["flags"] += f
        for cw in c.get("cutaways", []):
            m2, cx2, f2 = planner.reframe_mode(project.rush(cw["rush"]), tl["width"], tl["height"], tl["params"],
                                               cw["subject_x"], cw["subject_confidence"])
            cw["reframe"], cw["crop_x"] = m2, round(cx2, 3)
            c["flags"] += f2
        flags += c["flags"]
    tl["flags"] = [f for f in timeline["flags"] if not f.startswith("recadrage automatique")] + \
                  [f for f in flags if f.startswith("recadrage automatique")]
    if preset.get("max_duration") and tl["expected_duration"] > preset["max_duration"]:
        raise ProjectError(f"La timeline dure {tl['expected_duration']:.0f} s, au-delà des {preset['max_duration']} s "
                           f"autorisées par le format {preset['label']}.",
                           hint=f"Faites une version courte : revise \"version de {preset['max_duration']} secondes\".")
    return tl


def _cleanup_partials(project: Project) -> None:
    for d in ("cache", "exports", "previews"):
        for p in project.path(d).rglob("*.part.*"):
            p.unlink(missing_ok=True)
            project.journal(f"    fichier temporaire d'un rendu interrompu supprimé : {p.name}")


def render_and_check(project: Project, timeline: dict, preset_name: str, preview: bool) -> dict:
    """Rendu + contrôle qualité + corrections automatiques simples (au plus 2 tours)."""
    _cleanup_partials(project)
    tl = derive_for_preset(project, timeline, preset_name)
    applied = []
    for round_ in range(MAX_FIX_ROUNDS + 1):
        result = render.render(project, tl, preset_name, preview)
        report = qc.inspect(project, result, tl)
        fixes = {c["autofix"] for c in report["checks"] if c.get("autofix") and c["status"] != qc.OK}
        project.journal(f"    contrôle qualité : {report['status']}")
        for c in report["checks"]:
            if c["status"] != qc.OK:
                project.journal(f"      {'❌' if c['status'] == qc.FAIL else '⚠'} {c['check']} : {c['detail']}")
        if not fixes or round_ == MAX_FIX_ROUNDS:
            break
        if "subtitle_size" in fixes:
            tl["subtitle_scale"] = round(tl.get("subtitle_scale", 1.0) * 0.85, 3)
            applied.append(f"taille des sous-titres réduite à {tl['subtitle_scale'] * 100:.0f} %")
        preset = config.export_preset(preset_name)
        for c in report["checks"]:
            if c.get("autofix") == "loudness" and c["status"] != qc.OK and c.get("value") is not None:
                tl["loudness_offset"] = round(tl.get("loudness_offset", 0.0) + preset["loudness"] - c["value"], 2)
                applied.append(f"cible de normalisation corrigée de {preset['loudness'] - c['value']:+.1f} LU")
            if c.get("autofix") == "true_peak" and c["status"] != qc.OK:
                tl["true_peak_offset"] = round(tl.get("true_peak_offset", 0.0) - 1.0, 2)
                applied.append("limiteur de crêtes abaissé de 1 dB")
        project.journal(f"    correction automatique : {', '.join(applied[-len(fixes):])} — nouveau rendu")
    report["autofixes"] = applied
    atomic_write_text(Path(report["report_md"]).with_suffix(".json"), json.dumps(report, indent=2, ensure_ascii=False))
    atomic_write_text(Path(result["path"]).with_suffix(".timeline.json"), json.dumps(tl, indent=2, ensure_ascii=False))
    return {"render": result, "qc": report}


def _timeline(project: Project, version: int | None) -> dict:
    return project.load_timeline(version) if version else step_plan(project)


def step_preview(project: Project, preset: str | None = None, version: int | None = None) -> dict:
    tl = _timeline(project, version)
    preset = preset or tl["preset"]
    return _step(project, "prévisualisation", f"v{tl['version']}_{preset}",
                 lambda: render_and_check(project, tl, preset, preview=True))


def step_export(project: Project, presets: list[str] | None = None, version: int | None = None) -> list[dict]:
    tl = _timeline(project, version)
    presets = presets or tl["presets"]
    out = []
    for p in presets:
        out.append(_step(project, f"export {p}", f"v{tl['version']}_{p}",
                         lambda p=p: render_and_check(project, tl, p, preview=False)))
    project.state["approval"] = {"status": "en attente de validation humaine", "by": "", "at": "", "note": "",
                                 "files": [o["render"]["path"] for o in out]}
    project.save()
    write_delivery(project, tl, out)
    return out


def run_all(project: Project, sources: list | None = None, preview_only: bool = False) -> dict:
    if sources:
        step_import(project, sources)
    if not project.usable_rushes():
        raise ProjectError("Aucun rush exploitable dans ce projet.",
                           hint="Déposez des vidéos dans input/ puis lancez « import », ou passez --input.")
    step_analyze(project)
    tl = step_plan(project)
    prev = step_preview(project)
    if preview_only:
        return {"timeline": tl, "preview": prev}
    exports = step_export(project)
    return {"timeline": tl, "preview": prev, "exports": exports}


def approve(project: Project, by: str, note: str = "") -> dict:
    from .project import now
    if not project.state.get("approval", {}).get("files"):
        raise ProjectError("Rien à valider : aucun export final pour ce projet.", hint="Lancez d'abord « export ».")
    project.state["approval"].update(status="validé par un humain", by=by, at=now(), note=note)
    project.save()
    project.journal(f"Export validé par {by}{' — ' + note if note else ''}. (Aucune publication automatique.)")
    return project.state["approval"]


def write_delivery(project: Project, tl: dict, outs: list[dict]) -> Path:
    """Étape 12 — fiche de livraison : fichiers, caractéristiques, profil, points à vérifier."""
    L = [f"# Livraison — {project.state['name']}", "",
         f"Timeline v{tl['version']:03d} · profil **{tl['brief']['profile_label']}** · couleur {tl['color']} · "
         f"sous-titres {'oui (' + tl['subtitle_style'] + ')' if tl['captions'] else 'non'}", "",
         "**Statut : en attente de validation humaine.** Rien n'est publié automatiquement.", ""]
    for o in outs:
        r, q = o["render"], o["qc"]
        L += [f"## {Path(r['path']).name}", "",
              f"- Format : {r['preset']} — durée {r['duration']:.1f} s",
              f"- Contrôle qualité : **{q['status']}** (rapport : qc/{Path(q['report_md']).name})"]
        if q.get("autofixes"):
            L.append(f"- Corrections automatiques : {', '.join(q['autofixes'])}")
        if r["subtitles"].get("srt"):
            L.append(f"- Sous-titres : {Path(r['subtitles']['srt']).name} (+ .vtt)")
        L.append(f"- Audio de contrôle : {Path(r['path']).stem}_audio_controle.wav")
        L.append("")
    L += ["## Points à vérifier avant publication", ""]
    seen = []
    for o in outs:
        for h in o["qc"]["human_checks"]:
            if h not in seen:
                seen.append(h)
    L += [f"- [ ] {h}" for h in seen]
    L += ["", "Pour valider : `python3 studio.py approve " + project.state["slug"] + " --by \"Votre nom\"`"]
    p = project.path("exports", "LIVRAISON.md")
    atomic_write_text(p, "\n".join(L) + "\n")
    return p
