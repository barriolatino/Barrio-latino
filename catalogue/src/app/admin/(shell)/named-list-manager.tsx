"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/admin/toast";
import { Panel, field } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { flagEmoji } from "@/lib/format";
import { deleteBrandAction, deleteCountryAction, mergeBrandAction, saveBrandAction, saveCountryAction } from "../actions/taxonomy";

type Row = { id: string; name: string; isoCode?: string; count: number };

/** Gestion des marques et des pays : liste, ajout, renommage, suppression. */
export function NamedListManager({ kind, rows }: { kind: "brand" | "country"; rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const isCountry = kind === "country";

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? "Erreur", "error");
      toast(res.message ?? "Enregistré");
      after?.();
      router.refresh();
    });

  const form = (row?: Row) => (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = String(fd.get("name"));
        run(
          () => (isCountry ? saveCountryAction(row?.id ?? null, { name, isoCode: String(fd.get("iso")) }) : saveBrandAction(row?.id ?? null, name)),
          () => setEditing(null),
        );
      }}
    >
      <label className={`${field.label} flex-1`}>
        Nom
        <input name="name" defaultValue={row?.name} required autoFocus className={field.input} />
      </label>
      {isCountry && (
        <label className={field.label}>
          Code (2 lettres)
          <input name="iso" defaultValue={row?.isoCode} required maxLength={2} className={`${field.input} w-24 uppercase`} placeholder="CO" />
        </label>
      )}
      <button className={`${btn.base} ${btn.primary} ${btn.md}`} disabled={pending}>Enregistrer</button>
      <button type="button" className={`${btn.base} ${btn.ghost} ${btn.md}`} onClick={() => setEditing(null)}>Annuler</button>
    </form>
  );

  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap gap-2">
        {editing === "new" ? (
          <div className="w-full">{form()}</div>
        ) : (
          <>
            <button className={`${btn.base} ${btn.primary} ${btn.md}`} onClick={() => setEditing("new")}>+ {isCountry ? "Nouveau pays" : "Nouvelle marque"}</button>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer" className={`${field.input} mt-0 max-w-xs`} />
          </>
        )}
      </div>
      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.id} className="py-2">
            {editing === r.id ? (
              form(r)
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {isCountry && <span aria-hidden className="mr-2">{flagEmoji(r.isoCode ?? "")}</span>}
                  <span className="font-medium">{r.name}</span>
                  {isCountry && <span className="ml-2 text-xs text-ink-muted">{r.isoCode}</span>}
                  <Link href={`/admin/products?q=${encodeURIComponent(r.name)}`} className="tabular ml-2 text-sm text-ink-muted underline-offset-4 hover:underline">
                    {r.count} produit{r.count > 1 ? "s" : ""}
                  </Link>
                </span>
                <span className="flex flex-wrap gap-1">
                  {!isCountry && rows.length > 1 && (
                    <select
                      aria-label={`Fusionner ${r.name} avec…`}
                      className="h-9 rounded-full border border-line px-2 text-sm"
                      value=""
                      onChange={(e) => {
                        const target = rows.find((x) => x.id === e.target.value);
                        if (target && confirm(`Fusionner « ${r.name} » dans « ${target.name} » ? Les produits passeront sous « ${target.name} ».`)) {
                          run(() => mergeBrandAction(r.id, target.id));
                        }
                      }}
                    >
                      <option value="">Fusionner avec…</option>
                      {rows.filter((x) => x.id !== r.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  )}
                  <button className={`${btn.base} ${btn.secondary} ${btn.sm}`} onClick={() => setEditing(r.id)}>Modifier</button>
                  <button
                    className={`${btn.base} ${btn.sm} text-danger hover:bg-danger-bg`}
                    onClick={() => confirm(`Supprimer « ${r.name} » ?`) && run(() => (isCountry ? deleteCountryAction(r.id) : deleteBrandAction(r.id)))}
                  >
                    Supprimer
                  </button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
