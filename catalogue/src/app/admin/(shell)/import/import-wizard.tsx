"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "@/components/admin/toast";
import { Panel } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { applyImportAction, previewImportAction, type Preview } from "../../actions/import";

type Ok = Extract<Preview, { ok: true }>;
type Result = { name: string; ok: boolean; error?: string; warning?: string };

const CHUNK = 25;

export function ImportWizard() {
  const [preview, setPreview] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);

  if (results) {
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    return (
      <Panel title="Import terminé">
        <p className="text-lg"><strong className="tabular">{ok}</strong> produit{ok > 1 ? "s" : ""} enregistré{ok > 1 ? "s" : ""}.</p>
        {failed.length > 0 && (
          <div className="mt-3 rounded-md bg-danger-bg p-3 text-sm text-danger">
            <p className="font-semibold">{failed.length} ligne(s) non importée(s) :</p>
            <ul className="mt-1 list-disc pl-5">{failed.map((f, i) => <li key={i}>{f.name || "(sans nom)"} : {f.error}</li>)}</ul>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Link href="/admin/products?tri=maj" className={`${btn.base} ${btn.primary} ${btn.md}`}>Voir les produits</Link>
          <button className={`${btn.base} ${btn.secondary} ${btn.md}`} onClick={() => { setResults(null); setPreview(null); }}>Importer un autre fichier</button>
        </div>
      </Panel>
    );
  }

  if (!preview) {
    return (
      <Panel title="1. Choisir le fichier">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const res = await previewImportAction(fd);
              if (!res.ok) setError(res.error);
              else setPreview(res);
            });
          }}
        >
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-[#faf8f4] px-6 py-10 text-center hover:border-navy">
            <span className="font-semibold text-navy">Fichier Excel (.xlsx) ou CSV</span>
            <input name="file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="text-sm" />
          </label>
          {error && <p role="alert" className="mt-3 rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</p>}
          <button className={`${btn.base} ${btn.primary} ${btn.lg} mt-4`} disabled={pending}>{pending ? "Lecture du fichier…" : "Prévisualiser l'import"}</button>
        </form>
      </Panel>
    );
  }

  const creates = preview.plan.filter((p) => p.action === "create").length;
  const updates = preview.plan.filter((p) => p.action === "update").length;
  const errors = preview.plan.filter((p) => p.action === "error").length;
  const valid = preview.plan.map((p, i) => ({ p, row: preview.rows[i] })).filter(({ p }) => p.action !== "error");
  const shown = onlyIssues ? preview.plan.filter((p) => p.errors.length || p.warnings.length) : preview.plan;

  return (
    <Panel title="2. Vérifier avant d'importer">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-success-bg p-3"><p className="tabular text-2xl font-bold text-green">{creates}</p><p className="text-sm">nouveaux</p></div>
        <div className="rounded-lg bg-[#eef1fb] p-3"><p className="tabular text-2xl font-bold text-navy">{updates}</p><p className="text-sm">mis à jour</p></div>
        <div className="rounded-lg bg-danger-bg p-3"><p className="tabular text-2xl font-bold text-danger">{errors}</p><p className="text-sm">en erreur (ignorés)</p></div>
      </div>
      {preview.unknownHeaders.length > 0 && <p className="mt-3 text-sm text-ink-muted">Colonnes ignorées : {preview.unknownHeaders.join(", ")}</p>}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="h-4 w-4 accent-navy" />
        Afficher seulement les lignes avec erreur ou remarque
      </label>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#faf8f4] text-left text-xs uppercase text-ink-muted">
            <tr><th className="p-2">Ligne</th><th className="p-2">Action</th><th className="p-2">Produit</th><th className="p-2 text-right">Prix</th><th className="p-2">Remarques</th></tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.line} className={`border-t border-line align-top ${p.action === "error" ? "bg-danger-bg/50" : ""}`}>
                <td className="tabular p-2 text-ink-muted">{p.line}</td>
                <td className="p-2">
                  {p.action === "create" ? <span className="font-semibold text-green">Nouveau</span> : p.action === "update" ? <span className="font-semibold text-navy">Mise à jour</span> : <span className="font-semibold text-danger">Erreur</span>}
                </td>
                <td className="p-2">{p.name || "—"}{p.reference && <span className="block text-xs text-ink-muted">Réf. {p.reference}</span>}</td>
                <td className="tabular whitespace-nowrap p-2 text-right">
                  {p.priceBefore !== null && p.priceAfter !== null && p.priceBefore !== p.priceAfter && <span className="text-ink-muted line-through">{formatPrice(p.priceBefore)}</span>}{" "}
                  {p.priceAfter !== null ? formatPrice(p.priceAfter) : "—"}
                  {p.promoAfter !== null && <span className="block text-xs text-coral-text">promo {formatPrice(p.promoAfter)}</span>}
                </td>
                <td className="p-2 text-xs">
                  {p.errors.map((e) => <p key={e} className="text-danger">{e}</p>)}
                  {p.warnings.map((w) => <p key={w} className="text-ink-muted">{w}</p>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {progress && (
        <div className="mt-4" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-navy transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <p className="tabular mt-1 text-sm text-ink-muted">{progress.done} / {progress.total}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={`${btn.base} ${btn.primary} ${btn.lg}`}
          disabled={pending || valid.length === 0}
          onClick={() =>
            start(async () => {
              const all: Result[] = [];
              setProgress({ done: 0, total: valid.length });
              for (let i = 0; i < valid.length; i += CHUNK) {
                const chunk = valid.slice(i, i + CHUNK).map((v) => v.row);
                try {
                  all.push(...(await applyImportAction(chunk, preview.columns, i + CHUNK >= valid.length)));
                } catch {
                  toast("Interruption de l'import : relancez-le, les lignes déjà importées seront mises à jour", "error");
                  break;
                }
                setProgress({ done: Math.min(i + CHUNK, valid.length), total: valid.length });
              }
              setResults(all);
              setProgress(null);
            })
          }
        >
          {pending ? "Import en cours…" : `Importer ${valid.length} produit${valid.length > 1 ? "s" : ""}`}
        </button>
        <button className={`${btn.base} ${btn.ghost} ${btn.lg}`} disabled={pending} onClick={() => setPreview(null)}>Choisir un autre fichier</button>
      </div>
    </Panel>
  );
}
