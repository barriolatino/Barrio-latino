"""Interface web locale (bibliothèque standard uniquement) : python3 studio.py ui

Écoute par défaut sur 127.0.0.1 (cette machine uniquement). Les rushs sont envoyés
fichier par fichier en flux continu vers input/<projet>/ (pas de chargement complet
en mémoire). Chaque action lance la commande correspondante de studio.py dans un
processus séparé ; son journal s'affiche en direct.
"""

from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from . import config
from .ingest import VIDEO_EXT, AUDIO_EXT
from .project import Project, slugify

JOB = {"running": False, "cmd": [], "log": "", "code": None, "project": ""}
LOCK = threading.Lock()


def _run_job(args: list[str], project: str) -> None:
    with LOCK:
        if JOB["running"]:
            raise RuntimeError("Un traitement est déjà en cours.")
        JOB.update(running=True, cmd=args, log="", code=None, project=project)

    def work():
        env = dict(os.environ, PYTHONUNBUFFERED="1")
        proc = subprocess.Popen([sys.executable, str(config.STUDIO_ROOT / "studio.py"), *args], env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in proc.stdout:
            JOB["log"] += line
        JOB["code"] = proc.wait()
        JOB["running"] = False
    threading.Thread(target=work, daemon=True).start()


PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Video Studio</title>
<style>
:root{--bg:#f6f4f1;--card:#fff;--ink:#1d1b19;--mute:#6b645d;--line:#e2ddd6;--acc:#9a3412;--ok:#166534;--warn:#a16207;--bad:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#171513;--card:#211e1b;--ink:#efebe6;--mute:#a59d94;--line:#36312c;--acc:#f59e0b;--ok:#4ade80;--warn:#facc15;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}h1{font-size:20px;margin:8px 0 2px}p.sub{color:var(--mute);margin:0 0 16px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:0 0 14px}
h2{font-size:15px;margin:0 0 10px}label{display:block;font-size:13px;color:var(--mute);margin:8px 0 3px}
input,select,textarea,button{font:inherit;color:inherit}input,select,textarea{width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;background:var(--bg)}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
button{background:var(--acc);color:#fff;border:0;border-radius:7px;padding:9px 14px;cursor:pointer;margin:10px 8px 0 0}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}button:disabled{opacity:.5;cursor:wait}
pre{white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:10px;max-height:320px;overflow:auto;font-size:12.5px}
video{width:100%;max-height:70vh;background:#000;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;vertical-align:top}.ok{color:var(--ok)}.attention{color:var(--warn)}.échec{color:var(--bad)}
.files{font-size:13px;color:var(--mute)}a{color:var(--acc)}img{max-width:100%;border-radius:6px}
</style></head><body><main>
<h1>Claude Video Studio Pro</h1><p class="sub">Montage automatisé local. Rien n'est publié automatiquement : chaque export attend votre validation.</p>
<section><h2>1. Projet et rushs</h2>
<div class="row"><div><label>Projet existant</label><select id="proj"><option value="">— nouveau projet —</option>__PROJECTS__</select></div>
<div><label>Nom du nouveau projet</label><input id="pname" placeholder="ex. recette-empanadas"></div></div>
<label>Vidéos (déposées dans input/&lt;projet&gt;/, les originaux ne sont jamais modifiés)</label><input type="file" id="files" multiple accept="video/*">
<label>Musique (facultatif, uniquement si vous en avez les droits)</label><input type="file" id="music" accept="audio/*">
<div class="row"><div><label>Origine / licence de la musique</label><input id="mprov" placeholder="ex. bibliothèque X, licence Y"></div></div>
<div class="files" id="upl"></div></section>
<section><h2>2. Style</h2><div class="row">
<div><label>Profil</label><select id="profile"><option value="">automatique</option>__PROFILES__</select></div>
<div><label>Format(s)</label><select id="preset" multiple size="4">__PRESETS__</select></div>
<div><label>Durée cible (s, 0 = libre)</label><input id="duration" type="number" min="0" value="0"></div>
<div><label>Langue parlée</label><select id="lang"><option value="auto">auto</option><option>fr</option><option>en</option><option>es</option><option>pt</option></select></div></div>
<div class="row"><div><label>Titre d'ouverture (texte exact, facultatif)</label><input id="title"></div>
<div><label>Texte de fin (facultatif)</label><input id="endtext"></div></div>
<button id="go">Monter et prévisualiser</button></section>
<section><h2>3. Suivi</h2><pre id="log">En attente.</pre></section>
<section id="res" hidden><h2>4. Prévisualisation et contrôle qualité</h2><div id="out"></div>
<label>Demander une correction</label><input id="rev" placeholder="ex. Fais un montage plus dynamique / Les sous-titres sont trop grands / Fais une version de 30 secondes">
<button id="revbtn" class="ghost">Appliquer la correction</button><button id="exp">Exporter la version finale</button>
<label>Validation humaine</label><div class="row"><input id="by" placeholder="Votre nom"><button id="ok" class="ghost">Je valide l'export</button></div></section>
</main><script>
const $=s=>document.querySelector(s);let proj=$('#proj').value;
function name(){return $('#proj').value||$('#pname').value.trim()}
async function upload(p){const fs=[...$('#files').files];for(const [i,f] of fs.entries()){$('#upl').textContent=`Envoi ${i+1}/${fs.length} : ${f.name}…`;
 const r=await fetch(`/upload?project=${encodeURIComponent(p)}&name=${encodeURIComponent(f.name)}`,{method:'PUT',body:f});if(!r.ok)throw new Error(await r.text())}
 const m=$('#music').files[0];let mp='';if(m){const r=await fetch(`/upload?project=${encodeURIComponent(p)}&name=${encodeURIComponent(m.name)}&kind=music`,{method:'PUT',body:m});mp=(await r.json()).path}
 $('#upl').textContent=fs.length?`${fs.length} fichier(s) envoyé(s).`:'';return mp}
async function job(args){const r=await fetch('/api/run',{method:'POST',body:JSON.stringify(args)});if(!r.ok){alert(await r.text());return}poll()}
async function poll(){const j=await (await fetch('/api/job')).json();$('#log').textContent=j.log||'…';$('#log').scrollTop=1e9;
 document.querySelectorAll('button').forEach(b=>b.disabled=j.running);if(j.running){setTimeout(poll,1200)}else if(j.project){show(j.project)}}
async function show(p){const s=await (await fetch('/api/status?project='+encodeURIComponent(p))).json();if(!s.renders.length)return;$('#res').hidden=false;
 const last=s.renders[s.renders.length-1];let h=`<video controls src="/file?project=${encodeURIComponent(p)}&path=${encodeURIComponent(last.rel)}"></video>`;
 h+=`<p>${last.preview?'Prévisualisation':'Export final'} — ${last.duration.toFixed(1)} s — contrôle qualité : <b class="${s.qc.status==='échec'?'échec':(s.qc.status==='conforme'?'ok':'attention')}">${s.qc.status||'?'}</b></p>`;
 if(s.qc.checks){h+='<table>'+s.qc.checks.map(c=>`<tr><td>${c.check}</td><td class="${c.status}">${c.status}</td><td>${c.detail}</td></tr>`).join('')+'</table>'}
 if(s.qc.human_checks){h+='<p><b>À vérifier par un humain</b></p><ul>'+s.qc.human_checks.map(x=>`<li>${x}</li>`).join('')+'</ul>'}
 if(s.sheet)h+=`<img src="/file?project=${encodeURIComponent(p)}&path=${encodeURIComponent(s.sheet)}" alt="Planche contact">`;
 h+=`<p class="files">Plan de montage : ${s.plan} · validation : ${s.approval}</p>`;$('#out').innerHTML=h}
$('#go').onclick=async()=>{const p=name();if(!p){alert('Choisissez ou nommez un projet.');return}try{const mp=await upload(p);
 const a=['run',p,'--preview-only','--lang',$('#lang').value];if($('#profile').value)a.push('--profile',$('#profile').value);
 const ps=[...$('#preset').selectedOptions].map(o=>o.value);if(ps.length)a.push('--preset',ps.join(','));a.push('--duration',$('#duration').value||'0');
 if(mp){a.push('--music',mp);if($('#mprov').value)a.push('--music-provenance',$('#mprov').value)}if($('#title').value)a.push('--title',$('#title').value);
 if($('#endtext').value)a.push('--end-text',$('#endtext').value);if($('#files').files.length)a.push('--input','__AUTO__');job(a)}catch(e){alert(e.message)}};
$('#revbtn').onclick=()=>{const t=$('#rev').value.trim();if(t)job(['revise',name(),t,'--preview'])};
$('#exp').onclick=()=>job(['export',name()]);$('#ok').onclick=()=>{if(!$('#by').value.trim()){alert('Indiquez votre nom.');return}job(['approve',name(),'--by',$('#by').value.trim()])};
$('#proj').onchange=()=>{if($('#proj').value)show($('#proj').value)};poll();
</script></body></html>"""


def _page() -> str:
    projects = "".join(f'<option value="{html.escape(p["slug"])}">{html.escape(p["name"])}</option>'
                       for p in Project.list_all())
    profiles = "".join(f'<option value="{k}">{html.escape(v.get("label", k))}</option>'
                       for k, v in config.editorial_profiles().items() if k != "defaut")
    presets = "".join(f'<option value="{k}">{html.escape(v["label"])}</option>' for k, v in config.export_presets().items())
    return (PAGE.replace("__PROJECTS__", projects).replace("__PROFILES__", profiles).replace("__PRESETS__", presets)
            )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silencieux
        pass

    def _send(self, code: int, body: bytes | str, ctype: str = "text/plain; charset=utf-8") -> None:
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/":
            return self._send(200, _page(), "text/html; charset=utf-8")
        if u.path == "/api/job":
            return self._send(200, json.dumps(JOB), "application/json")
        if u.path == "/api/status":
            return self._status(q.get("project", ""))
        if u.path == "/file":
            return self._file(q.get("project", ""), q.get("path", ""))
        self._send(404, "introuvable")

    def _status(self, name: str):
        try:
            p = Project.open(name)
        except Exception as e:
            return self._send(404, str(e))
        renders = [{**r, "rel": str(Path(r["path"]).relative_to(p.root))} for r in p.state["renders"]
                   if Path(r["path"]).exists()]
        qc, sheet = {}, ""
        if renders:
            qj = p.path("qc", Path(renders[-1]["path"]).stem + "_qc.json")
            if qj.exists():
                qc = json.loads(qj.read_text(encoding="utf-8"))
                if qc.get("contact_sheet"):
                    sheet = str(Path(qc["contact_sheet"]).relative_to(p.root))
        v = p.state["timeline_versions"]
        plan = v[-1].replace("timeline/v", "timeline/plan_v").replace(".json", ".md") if v else "—"
        self._send(200, json.dumps({"renders": renders, "qc": qc, "sheet": sheet, "plan": plan,
                                    "approval": p.state["approval"]["status"]}, ensure_ascii=False),
                   "application/json")

    def _file(self, name: str, rel: str):
        try:
            p = Project.open(name)
        except Exception as e:
            return self._send(404, str(e))
        f = (p.root / unquote(rel)).resolve()
        if not str(f).startswith(str(p.root)) or not f.is_file():
            return self._send(403, "accès refusé")
        ctype = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".md": "text/plain; charset=utf-8"}.get(f.suffix, "application/octet-stream")
        size = f.stat().st_size
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng and (m := re.match(r"bytes=(\d*)-(\d*)", rng)):
            start = int(m.group(1) or 0)
            end = int(m.group(2)) if m.group(2) else size - 1
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(f, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = fh.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def do_PUT(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path != "/upload":
            return self._send(404, "introuvable")
        name = Path(q.get("name", "")).name
        ext = Path(name).suffix.lower()
        music = q.get("kind") == "music"
        if not name or ext not in (AUDIO_EXT if music else VIDEO_EXT):
            return self._send(400, f"Type de fichier non accepté : {name}")
        base = config.workspace() / ("assets/music" if music else f"input/{slugify(q.get('project', 'projet'))}")
        base.mkdir(parents=True, exist_ok=True)
        dest = base / name
        if dest.exists() and not music:
            return self._send(200, json.dumps({"path": str(dest), "note": "déjà présent"}), "application/json")
        left = int(self.headers.get("Content-Length", 0))
        tmp = dest.with_suffix(dest.suffix + ".upload")
        with open(tmp, "wb") as fh:
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                fh.write(chunk)
                left -= len(chunk)
        if left:
            tmp.unlink(missing_ok=True)
            return self._send(400, "Envoi incomplet.")
        os.replace(tmp, dest)
        self._send(200, json.dumps({"path": str(dest)}), "application/json")

    def do_POST(self):
        if urlparse(self.path).path != "/api/run":
            return self._send(404, "introuvable")
        args = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"[]")
        allowed = {"run", "revise", "export", "approve", "preview"}
        if not args or args[0] not in allowed or not all(isinstance(a, str) for a in args):
            return self._send(400, "Commande non autorisée depuis l'interface.")
        if "__AUTO__" in args and len(args) > 1:  # dossier de dépôt du projet
            args = [str(config.workspace() / "input" / slugify(args[1])) if a == "__AUTO__" else a for a in args]
        try:
            _run_job(args, slugify(args[1]) if len(args) > 1 else "")
        except RuntimeError as e:
            return self._send(409, str(e))
        self._send(200, "{}", "application/json")


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    srv = ThreadingHTTPServer((host, port), Handler)
    print(f"Interface : http://{host}:{port}  (Ctrl+C pour arrêter)")
    if host not in ("127.0.0.1", "localhost"):
        print("⚠ L'interface est accessible depuis le réseau : n'exposez pas ce service publiquement.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
