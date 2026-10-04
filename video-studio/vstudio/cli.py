"""Interface en ligne de commande : python3 studio.py <commande> …

Toutes les commandes sont réellement exécutables ; « help » les décrit.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from . import __version__, config, ffmpeg
from .errors import StudioError
from .project import Project

HELP = """
CLAUDE VIDEO STUDIO PRO — montage vidéo automatisé (FFmpeg + Python)

Démarrage rapide
  1. Déposez vos vidéos dans video-studio/input/<nom-du-projet>/
  2. python3 studio.py run <nom-du-projet> --input input/<nom-du-projet> [--profile reseaux_sociaux] [--preset tiktok]
  3. Regardez la prévisualisation (projects/<nom>/previews/) et le contrôle qualité (projects/<nom>/qc/)
  4. Corrigez si besoin : python3 studio.py revise <nom> "Fais un montage plus dynamique"
  5. Exportez puis validez : python3 studio.py export <nom> ; python3 studio.py approve <nom> --by "Votre nom"

Commandes
  run        tout enchaîner : import → analyse → plan → prévisualisation → export → contrôle qualité
  new        créer un projet                         import    importer et vérifier des rushs
  analyze    analyser les rushs (rapport)             style     choisir/modifier le style, lister les profils
  edit       construire le plan de montage           captions  générer/corriger les sous-titres
  audio      réglages son (débruitage, musique)      color     profil de couleur
  preview    prévisualisation                        revise    correction en langage naturel
  export     export final (un ou plusieurs formats)   quality   contrôle qualité d'un rendu
  approve    validation humaine d'un export          batch     traiter plusieurs dossiers de rushs
  project    lister / afficher / reprendre un projet  reference analyser une vidéo de référence autorisée
  principles bibliothèque de principes éditoriaux    demo      créer des rushs de démonstration
  ui         interface web locale                     doctor    vérifier l'installation

Aucune publication automatique n'est faite : la livraison attend toujours une validation humaine.
Aide détaillée d'une commande : python3 studio.py <commande> -h
"""


def _settings_from(args) -> dict:
    s = {}
    if getattr(args, "profile", None):
        s["profile"] = args.profile
    if getattr(args, "preset", None):
        s["presets"] = [p.strip() for p in args.preset.split(",") if p.strip()]
        for p in s["presets"]:
            config.export_preset(p)
    if getattr(args, "duration", None) is not None:
        s["target_duration"] = args.duration
    if getattr(args, "music", None) is not None:
        if args.music and not Path(args.music).exists():
            raise StudioError(f"Musique introuvable : {args.music}")
        s["music"] = str(Path(args.music).resolve()) if args.music else ""
    if getattr(args, "music_provenance", None):
        s["music_provenance"] = args.music_provenance
    if getattr(args, "lang", None):
        s["lang"] = args.lang
    if getattr(args, "title", None) is not None:
        s["title"] = args.title
    if getattr(args, "end_text", None) is not None:
        s["end_text"] = args.end_text
    if getattr(args, "speaker", None):
        sp = {}
        for item in args.speaker:
            if "=" not in item:
                raise StudioError(f"Format d'intervenant invalide : {item}", hint='Utilisez r01="Nom — fonction".')
            k, v = item.split("=", 1)
            sp[k.strip()] = v.strip()
        s["speakers"] = sp
    if getattr(args, "captions", None) is not None:
        s["captions"] = args.captions
    if getattr(args, "profile", None):
        config.editorial_profile(args.profile)
    return s


def _common(p: argparse.ArgumentParser) -> None:
    g = p.add_argument_group("réglages du montage")
    g.add_argument("--profile", help="profil éditorial (voir « style --list »)")
    g.add_argument("--preset", help="format(s) d'export, séparés par des virgules (tiktok,youtube…)")
    g.add_argument("--duration", type=float, help="durée cible en secondes (0 = libre)")
    g.add_argument("--music", help="fichier musical dont vous avez les droits")
    g.add_argument("--music-provenance", help="origine/licence de la musique (reportée dans la livraison)")
    g.add_argument("--lang", help="langue parlée : fr, en, es… ou auto")
    g.add_argument("--title", help="titre affiché en ouverture (texte exact, rien n'est inventé)")
    g.add_argument("--end-text", help="texte de fin / appel à l'action (texte exact)")
    g.add_argument("--speaker", action="append", help='nom affiché pour un rush : r01="Ana Lopez — cheffe"')
    cg = g.add_mutually_exclusive_group()
    cg.add_argument("--captions", dest="captions", action="store_true", default=None, help="forcer les sous-titres")
    cg.add_argument("--no-captions", dest="captions", action="store_false", help="pas de sous-titres")


def _open_or_create(name: str, args) -> Project:
    settings = _settings_from(args)
    try:
        proj = Project.open(name)
        if settings:
            proj.settings.update(settings)
            proj.save()
        return proj
    except StudioError:
        return Project.create(name, settings)


def _print_outputs(project: Project, res: dict) -> None:
    r, q = res["render"], res["qc"]
    print(f"\n  Fichier : {r['path']}")
    print(f"  Durée : {r['duration']:.1f} s — contrôle qualité : {q['status'].upper()}")
    print(f"  Rapport : {q['report_md']}")
    if q.get("contact_sheet"):
        print(f"  Planche contact : {q['contact_sheet']}")
    if q["human_checks"]:
        print("  À vérifier par un humain :")
        for h in q["human_checks"]:
            print(f"    - {h}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="studio.py", add_help=False)
    ap.add_argument("-V", "--version", action="version", version=f"Claude Video Studio Pro {__version__}")
    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("help")
    sub.add_parser("doctor", help="vérifier l'installation")
    p = sub.add_parser("demo", help="créer des rushs de démonstration synthétiques")
    p.add_argument("--dest", default=None)

    p = sub.add_parser("new", help="créer un projet")
    p.add_argument("name")
    _common(p)

    p = sub.add_parser("import", help="importer et vérifier des rushs")
    p.add_argument("project")
    p.add_argument("sources", nargs="*", help="fichiers ou dossiers (défaut : input/<projet>/)")

    p = sub.add_parser("analyze", help="analyser les rushs")
    p.add_argument("project")
    p.add_argument("--force", action="store_true", help="refaire l'analyse même si elle existe")

    p = sub.add_parser("style", help="choisir ou modifier le style")
    p.add_argument("project", nargs="?")
    p.add_argument("--list", action="store_true", help="lister profils, formats, couleurs, sous-titres")
    p.add_argument("--profile")
    p.add_argument("--set", action="append", default=[], metavar="clé=valeur", help="surcharger un paramètre du profil")
    p.add_argument("--save-as", help="enregistrer les réglages comme profil personnalisé")
    p.add_argument("--reset", action="store_true", help="annuler toutes les surcharges")

    p = sub.add_parser("edit", help="construire le plan de montage")
    p.add_argument("project")
    p.add_argument("--variants", type=int, default=0, help="nombre de propositions différentes (2 à 5)")
    _common(p)

    p = sub.add_parser("captions", help="générer ou corriger les sous-titres")
    p.add_argument("project")
    p.add_argument("--style", help="style : " + ", ".join(config.subtitle_styles()))
    p.add_argument("--scale", type=float, help="échelle de taille (ex. 0.9)")
    p.add_argument("--on", dest="captions", action="store_true", default=None)
    p.add_argument("--off", dest="captions", action="store_false")
    p.add_argument("--lang")
    p.add_argument("--show", action="store_true", help="afficher la transcription par rush")

    p = sub.add_parser("audio", help="réglages du son")
    p.add_argument("project")
    p.add_argument("--denoise", type=float, help="réduction de bruit 0..1 (défaut du profil, modéré)")
    p.add_argument("--music", help="musique (fichier dont vous avez les droits) ; \"\" pour retirer")
    p.add_argument("--music-provenance")
    p.add_argument("--music-level", type=float, help="niveau de la musique hors voix, en dB (ex. -14)")
    p.add_argument("--duck", type=float, help="atténuation sous la voix, en dB (ex. -12)")
    p.add_argument("--no-compress", action="store_true")
    p.add_argument("--report", action="store_true", help="afficher les mesures audio des rushs")

    p = sub.add_parser("color", help="profil colorimétrique")
    p.add_argument("project")
    p.add_argument("--profile", help="profil : " + ", ".join(config.color_profiles()))

    for name in ("preview", "export"):
        p = sub.add_parser(name, help="prévisualisation" if name == "preview" else "export final")
        p.add_argument("project")
        p.add_argument("--preset", help="format(s), séparés par des virgules")
        p.add_argument("--version", type=int, help="version de timeline (défaut : la dernière)")

    p = sub.add_parser("revise", help="correction en langage naturel")
    p.add_argument("project")
    p.add_argument("text")
    p.add_argument("--preview", action="store_true", help="générer directement la prévisualisation")

    p = sub.add_parser("quality", help="contrôle qualité")
    p.add_argument("project")
    p.add_argument("--file", help="rendu précis à contrôler (défaut : le dernier)")

    p = sub.add_parser("approve", help="validation humaine")
    p.add_argument("project")
    p.add_argument("--by", required=True)
    p.add_argument("--note", default="")

    p = sub.add_parser("batch", help="traiter plusieurs dossiers de rushs")
    p.add_argument("folder", help="dossier contenant un sous-dossier par vidéo à monter (ou des fichiers)")
    p.add_argument("--preview-only", action="store_true")
    _common(p)

    p = sub.add_parser("project", help="projets")
    p.add_argument("action", choices=["list", "show", "status"], nargs="?", default="list")
    p.add_argument("name", nargs="?")

    p = sub.add_parser("run", help="enchaîner toutes les étapes")
    p.add_argument("project")
    p.add_argument("--input", nargs="*", help="fichiers/dossiers de rushs (défaut : input/<projet>/)")
    p.add_argument("--preview-only", action="store_true", help="s'arrêter à la prévisualisation")
    _common(p)

    p = sub.add_parser("reference", help="analyser une vidéo de référence (fournie et autorisée)")
    p.add_argument("video")
    p.add_argument("--name")
    p.add_argument("--source", default="", help="origine et autorisation (ex. « vidéo fournie par le client »)")

    sub.add_parser("principles", help="bibliothèque de principes éditoriaux")
    p = sub.add_parser("ui", help="interface web locale")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--host", default="127.0.0.1")
    return ap


def main(argv: list[str] | None = None) -> int:
    ap = build_parser()
    args = ap.parse_args(argv)
    if args.cmd in (None, "help"):
        print(HELP)
        return 0
    try:
        ffmpeg.check_tools()
        return _dispatch(args) or 0
    except StudioError as e:
        print(f"\n❌ {e.message}", file=sys.stderr)
        if e.hint:
            print(f"   → {e.hint}", file=sys.stderr)
        if e.details and os.environ.get("VSTUDIO_DEBUG"):
            print(e.details, file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\n⏸  Interrompu. Relancez la même commande pour reprendre là où le travail s'est arrêté.",
              file=sys.stderr)
        return 130


def _default_input(name: str) -> list[str]:
    from .project import slugify
    for cand in (config.workspace() / "input" / name, config.workspace() / "input" / slugify(name)):
        if cand.is_dir():
            return [str(cand)]
    raise StudioError(f"Aucun rush indiqué et le dossier input/{name}/ n'existe pas.",
                      hint=f"Déposez vos vidéos dans {config.workspace() / 'input' / name}/ ou passez des fichiers.")


def _dispatch(args) -> int:
    from . import pipeline, revise as rv
    c = args.cmd
    if c == "doctor":
        return _doctor()
    if c == "demo":
        from .demo import make_demo_set
        dest = Path(args.dest) if args.dest else config.workspace() / "input" / "demo"
        print(f"Génération des rushs de démonstration dans {dest} …")
        info = make_demo_set(dest)
        print(f"✓ 3 rushs + 1 musique ({info['music']}). Provenance : {dest / 'PROVENANCE.txt'}")
        print(f"Essayez : python3 studio.py run demo --music {info['music']} --lang en")
        return 0
    if c == "new":
        proj = Project.create(args.name, _settings_from(args))
        print(f"✓ Projet créé : {proj.root}")
        return 0
    if c == "import":
        proj = _open_or_create(args.project, args)
        pipeline.step_import(proj, args.sources or _default_input(args.project))
        return 0
    if c == "analyze":
        proj = Project.open(args.project)
        pipeline.step_analyze(proj, force=args.force)
        print(f"\n  Rapport : {proj.path('analysis', 'rapport_analyse.md')}")
        return 0
    if c == "style":
        return _style(args)
    if c == "edit":
        proj = Project.open(args.project)
        st = _settings_from(args)
        proj.settings.update(st)
        proj.save()
        if args.variants:
            pipeline.step_plan(proj)
            res = rv.make_variants(proj, max(2, min(5, args.variants)))
            print("\n  Propositions :")
            for v in res:
                print(f"    v{v['version']:03d}  {v['variant']:<24} {v['duration']:.1f} s, {v['clips']} plans")
            print("  Prévisualiser : python3 studio.py preview", proj.state["slug"], "--version N")
            return 0
        tl = pipeline.step_plan(proj, force=bool(st))
        print(f"\n  Plan : {proj.path('timeline', 'plan_v%03d.md' % tl['version'])}")
        return 0
    if c == "captions":
        return _captions(args)
    if c == "audio":
        return _audio(args)
    if c == "color":
        proj = Project.open(args.project)
        if not args.profile:
            for k, v in config.color_profiles().items():
                print(f"  {k:<16} {v['label']}")
            return 0
        config.color_profile(args.profile)
        proj.settings.setdefault("overrides", {})["color"] = args.profile
        proj.save()
        tl = pipeline.step_plan(proj)
        print(f"✓ Couleur « {args.profile} » — timeline v{tl['version']:03d}. Lancez « preview » pour voir le rendu.")
        return 0
    if c in ("preview", "export"):
        proj = Project.open(args.project)
        presets = [p.strip() for p in args.preset.split(",")] if args.preset else None
        if c == "preview":
            for p in presets or [None]:
                _print_outputs(proj, pipeline.step_preview(proj, p, args.version))
        else:
            for res in pipeline.step_export(proj, presets, args.version):
                _print_outputs(proj, res)
            print(f"\n  Fiche de livraison : {proj.path('exports', 'LIVRAISON.md')}")
            print("  Statut : en attente de validation humaine (aucune publication automatique).")
        return 0
    if c == "revise":
        proj = Project.open(args.project)
        res = rv.apply(proj, args.text)
        print("\n  Modifications appliquées :")
        for ch in res["changes"]:
            print(f"    - {ch}")
        if "variants" in res:
            for v in res["variants"]:
                print(f"    v{v['version']:03d}  {v['variant']:<24} {v['duration']:.1f} s")
        else:
            tl = res["timeline"]
            print(f"  Nouvelle timeline v{tl['version']:03d} ({tl['expected_duration']:.1f} s) — "
                  f"versions précédentes conservées dans timeline/")
            if args.preview:
                _print_outputs(proj, pipeline.step_preview(proj, version=tl["version"]))
        return 0
    if c == "quality":
        return _quality(args)
    if c == "approve":
        proj = Project.open(args.project)
        a = pipeline.approve(proj, args.by, args.note)
        print(f"✓ Validé par {a['by']} le {a['at']}. Fichiers : ")
        for f in a["files"]:
            print(f"    {f}")
        print("  La publication reste manuelle.")
        return 0
    if c == "batch":
        return _batch(args)
    if c == "project":
        return _project(args)
    if c == "run":
        proj = _open_or_create(args.project, args)
        sources = args.input if args.input else (None if proj.usable_rushes() else _default_input(args.project))
        res = pipeline.run_all(proj, sources, preview_only=args.preview_only)
        print("\n═══ Prévisualisation ═══")
        _print_outputs(proj, res["preview"])
        for e in res.get("exports", []):
            print("\n═══ Export final ═══")
            _print_outputs(proj, e)
        if res.get("exports"):
            print(f"\n  Fiche de livraison : {proj.path('exports', 'LIVRAISON.md')}")
            print("  Statut : en attente de validation humaine (aucune publication automatique).")
        return 0
    if c == "reference":
        from .reference import analyze_reference
        r = analyze_reference(args.video, args.name, args.source)
        print(f"✓ Analyse enregistrée : {r['report']}")
        return 0
    if c == "principles":
        from .reference import principles
        for p in principles():
            print(f"\n■ {p['nom']}  [{p['confiance']}, vérifié {p['verifie_le']}]")
            print(f"  pour : {p['contenus']}\n  pourquoi : {p['pourquoi']}\n  limites : {p['limites']}")
        return 0
    if c == "ui":
        from .ui import serve
        serve(args.host, args.port)
        return 0
    raise StudioError(f"Commande inconnue : {c}")


def _doctor() -> int:
    from .analysis.transcribe import available_engines
    import subprocess
    v = subprocess.run([ffmpeg.FFMPEG, "-version"], capture_output=True, text=True).stdout.splitlines()[0]
    print(f"✓ {v}")
    need = ["libx264", "libass", "loudnorm", "sidechaincompress", "scdet", "xfade", "afftdn"]
    filters = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    encs = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    for n in need:
        ok = (f" {n} " in filters) or (n in encs) or (n == "libass" and " ass " in filters)
        print(f"{'✓' if ok else '✗'} {n}")
    try:
        import numpy
        print(f"✓ numpy {numpy.__version__}")
    except ImportError:
        print("✗ numpy manquant : pip install -r requirements.txt")
    eng = available_engines()
    for k, val in eng.items():
        print(f"✓ transcription {k} : {val}")
    if not eng:
        print("✗ aucun moteur de transcription (sous-titres seulement depuis des .srt fournis)")
    print(f"  Dossier de travail : {config.workspace()}")
    return 0


def _style(args) -> int:
    if args.list or not args.project:
        print("Profils éditoriaux :")
        for k, v in config.editorial_profiles().items():
            if k != "defaut":
                print(f"  {k:<18} {v.get('label', '')} — {v.get('description', '')}")
        print("\nFormats d'export :")
        for k, v in config.export_presets().items():
            print(f"  {k:<18} {v['label']} ({v['width'] or 'source'}×{v['height'] or 'source'})")
        print("\nCouleurs :", ", ".join(config.color_profiles()))
        print("Sous-titres :", ", ".join(config.subtitle_styles()))
        return 0
    from . import pipeline
    proj = Project.open(args.project)
    s = proj.settings
    if args.reset:
        s["overrides"] = {}
    if args.profile:
        config.editorial_profile(args.profile)
        s["profile"] = args.profile
    ov = dict(s.get("overrides") or {})
    for item in args.set:
        if "=" not in item:
            raise StudioError(f"Réglage invalide : {item}", hint="Format attendu : clé=valeur (ex. pause_max=0.8).")
        k, v = item.split("=", 1)
        ov[k.strip()] = _parse_value(v.strip())
    base = s.get("profile") or (proj.load_timeline()["profile"] if proj.state["timeline_versions"] else "defaut")
    prof = config.editorial_profile(base, ov)
    s["overrides"] = ov
    proj.save()
    if args.save_as:
        path = config.save_custom_profile(args.save_as, base, ov)
        print(f"✓ Profil personnalisé enregistré : {path}")
    print(f"Profil « {base} » ({prof['label']}) avec {len(ov)} réglage(s) personnalisé(s) :")
    for k in ("color", "default_preset", "hook", "pause_max", "pause_keep", "min_shot", "max_shot", "transition",
              "beat_sync", "broll_cutaways", "denoise", "music_db", "duck_db"):
        print(f"  {k:<16} {prof[k]}{'  ← personnalisé' if k in ov else ''}")
    if proj.usable_rushes() and proj.state["steps"].get("analyse", {}).get("status") == "terminé":
        tl = pipeline.step_plan(proj)
        print(f"  → timeline v{tl['version']:03d}")
    return 0


def _parse_value(v: str):
    if v.lower() in ("true", "oui", "vrai"):
        return True
    if v.lower() in ("false", "non", "faux"):
        return False
    try:
        return float(v) if "." in v else int(v)
    except ValueError:
        return v


def _captions(args) -> int:
    from . import pipeline, subtitles as S
    from .analysis.runner import load_transcript
    proj = Project.open(args.project)
    s = proj.settings
    if args.show:
        for r in proj.usable_rushes():
            tr = load_transcript(proj, r["id"])
            print(f"\n{r['id']} {r['name']} — moteur : {tr.get('engine')} {tr.get('note', '')}")
            for seg in tr.get("segments", []):
                flag = f"   [incertain : {', '.join(seg['uncertain'])}]" if seg.get("uncertain") else ""
                print(f"  {seg['start']:7.2f}–{seg['end']:7.2f}  {seg['text']}{flag}")
        print(f"\nPour corriger : modifiez {proj.path('transcripts')}/<rush>.json, ajoutez \"edited_by_user\": true, "
              "puis relancez « captions ».")
        return 0
    if args.style:
        config.subtitle_style(args.style)
        s.setdefault("overrides", {})["subtitle_style"] = args.style
    if args.scale:
        s["subtitle_scale"] = args.scale
    if args.captions is not None:
        s["captions"] = args.captions
    if args.lang:
        s["lang"] = args.lang
    proj.save()
    if args.lang:
        pipeline.step_analyze(proj, force=False)
    tl = pipeline.step_plan(proj)
    transcripts = {r["id"]: load_transcript(proj, r["id"]) for r in proj.usable_rushes()}
    from .render import _timeline_lang
    tl["lang"] = _timeline_lang(proj, transcripts)
    style = S.style_for(tl)
    cues = S.make_cues(tl, transcripts, style)
    if not cues:
        notes = {tr.get("note") for tr in transcripts.values() if tr.get("note")}
        print("Aucun sous-titre : aucune parole transcrite." + (f" ({'; '.join(notes)})" if notes else ""))
        return 0
    base = proj.path("subtitles", f"{proj.state['slug']}_v{tl['version']:03d}")
    S.write_srt(cues, base.with_suffix(".srt"))
    S.write_vtt(cues, base.with_suffix(".vtt"))
    n = S.write_review_list(cues, proj.path("subtitles", "a_verifier.txt"))
    print(f"✓ {len(cues)} sous-titres — style {style['name']} — {base}.srt / .vtt")
    if n:
        print(f"  ⚠ {n} sous-titre(s) avec des mots incertains : {proj.path('subtitles', 'a_verifier.txt')}")
    print("  Incrustation : lancez « preview » ou « export ».")
    return 0


def _audio(args) -> int:
    from . import pipeline
    proj = Project.open(args.project)
    s = proj.settings
    ov = s.setdefault("overrides", {})
    if args.denoise is not None:
        ov["denoise"] = max(0.0, min(1.0, args.denoise))
    if args.music_level is not None:
        ov["music_db"] = args.music_level
    if args.duck is not None:
        ov["duck_db"] = args.duck
    if args.no_compress:
        ov["compress"] = False
    if args.music is not None:
        if args.music and not Path(args.music).exists():
            raise StudioError(f"Musique introuvable : {args.music}")
        s["music"] = str(Path(args.music).resolve()) if args.music else ""
    if args.music_provenance:
        s["music_provenance"] = args.music_provenance
    proj.save()
    if args.report:
        for r in proj.usable_rushes():
            p = proj.path("analysis", f"{r['id']}.json")
            if p.exists():
                a = json.loads(p.read_text(encoding="utf-8")).get("audio", {})
                ld = a.get("loudness", {})
                print(f"  {r['id']} {r['name']}: "
                      + (f"{ld.get('integrated_lufs')} LUFS, crête {ld.get('true_peak_dbtp')} dBTP, bruit "
                         f"{a.get('noise_floor_db')} dBFS, {', '.join(a.get('issues', [])) or 'RAS'}"
                         if a.get("present") else "pas de son"))
    tl = pipeline.step_plan(proj)
    prof = tl["params"]
    print(f"✓ Son : débruitage {prof['denoise']}, compression {'oui' if prof['compress'] else 'non'}, "
          f"musique {'« ' + Path(tl['music']['path']).name + ' »' if tl.get('music') else 'aucune'}"
          f" ({prof['music_db']} dB, ducking {prof['duck_db']} dB) — timeline v{tl['version']:03d}")
    return 0


def _quality(args) -> int:
    from . import qc
    proj = Project.open(args.project)
    renders = proj.state.get("renders", [])
    if args.file:
        renders = [r for r in renders if Path(r["path"]).resolve() == Path(args.file).resolve()]
    if not renders:
        raise StudioError("Aucun rendu à contrôler.", hint="Lancez « preview » ou « export » d'abord.")
    r = renders[-1]
    tl_path = Path(r["path"]).with_suffix(".timeline.json")
    tl = json.loads(tl_path.read_text(encoding="utf-8")) if tl_path.exists() else proj.load_timeline(r["timeline_version"])
    rep = qc.inspect(proj, r, tl)
    print(Path(rep["report_md"]).read_text(encoding="utf-8"))
    return 0 if rep["status"] != "échec" else 1


def _batch(args) -> int:
    from . import pipeline
    root = Path(args.folder)
    if not root.is_dir():
        raise StudioError(f"Dossier introuvable : {root}")
    from .ingest import VIDEO_EXT
    jobs = [(d.name, [str(d)]) for d in sorted(root.iterdir()) if d.is_dir()]
    jobs += [(f.stem, [str(f)]) for f in sorted(root.iterdir()) if f.is_file() and f.suffix.lower() in VIDEO_EXT]
    if not jobs:
        raise StudioError("Aucun sous-dossier ni vidéo dans ce dossier.")
    results = []
    for name, src in jobs:
        print(f"\n═══ {name} ═══")
        try:
            proj = _open_or_create(name, args)
            res = pipeline.run_all(proj, src if not proj.usable_rushes() else None, preview_only=args.preview_only)
            final = res.get("exports", [res["preview"]])
            results.append((name, "ok", ", ".join(f"{Path(x['render']['path']).name} [{x['qc']['status']}]" for x in final)))
        except StudioError as e:  # un projet en échec n'arrête pas le lot
            results.append((name, "échec", e.message))
            print(f"❌ {e.message}")
    print("\n═══ Bilan du lot ═══")
    for name, st, detail in results:
        print(f"  {'✓' if st == 'ok' else '✗'} {name:<24} {detail}")
    return 0 if all(r[1] == "ok" for r in results) else 1


def _project(args) -> int:
    if args.action == "list" or not args.name:
        items = Project.list_all()
        if not items:
            print("Aucun projet. Créez-en un avec « new » ou « run ».")
        for p in items:
            steps = ", ".join(f"{k}:{v}" for k, v in p["steps"].items())
            print(f"  {p['slug']:<24} {p['rushes']} rush(s)  {p['updated']}  [{p['approval']}]\n      {steps}")
        return 0
    proj = Project.open(args.name)
    st = proj.state
    print(f"Projet {st['name']} ({proj.root})")
    print(f"  Réglages : {json.dumps(st['settings'], ensure_ascii=False)}")
    print("  Rushs :")
    for r in st["rushes"]:
        print(f"    {r['id']} {r['name']} — {r['status']}{' : ' + r['reason'] if r['reason'] else ''}")
    print("  Étapes :")
    for k, v in st["steps"].items():
        print(f"    {k:<20} {v['status']:<10} {v['at']}{' — ' + v['detail'] if v.get('detail') else ''}")
    print(f"  Timelines : {', '.join(st['timeline_versions']) or 'aucune'}")
    for r in st["renders"][-6:]:
        print(f"  Rendu : {Path(r['path']).name} ({'prévisualisation' if r['preview'] else 'final'}, {r['duration']:.1f} s)")
    print(f"  Validation : {st['approval']['status']}")
    failed = [k for k, v in st["steps"].items() if v["status"] in ("échec", "en cours")]
    if failed:
        print(f"  ⚠ Étape(s) interrompue(s) : {', '.join(failed)} — relancez « run {st['slug']} » pour reprendre.")
    return 0
