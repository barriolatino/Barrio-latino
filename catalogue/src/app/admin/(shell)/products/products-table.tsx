"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/components/admin/toast";
import { field } from "@/components/admin/ui";
import { ChevronDown, ChevronUp, GripIcon, ImageIcon } from "@/components/icons";
import { btn } from "@/components/ui";
import { centsToInput, formatPrice } from "@/lib/format";
import { mediaSrc } from "@/lib/media-url";
import {
  bulkAction,
  deleteProductsAction,
  duplicateProductAction,
  quickUpdateAction,
  reorderProductsAction,
  restoreDeletedAction,
  type BulkOp,
} from "../../actions/products";

export type AdminRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  reference: string | null;
  categoryId: string;
  priceCents: number;
  promoCents: number | null;
  promoEndsAt: string | null;
  casePriceCents: number | null;
  caseQuantity: number | null;
  saleUnit: "UNIT" | "KG";
  available: boolean;
  published: boolean;
  isNew: boolean;
  featured: boolean;
  isExample: boolean;
  deleted: boolean;
  imageKey: string | null;
};

type Cat = { id: string; label: string };

/** Cellule de prix : clic → saisie → Entrée = enregistré. Échap annule. */
function PriceCell({
  row,
  kind,
  onSaved,
}: {
  row: AdminRow;
  kind: "price" | "promo";
  onSaved: (cents: number | null) => void;
}) {
  const current = kind === "price" ? row.priceCents : row.promoCents;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed === centsToInput(current)) return setEditing(false);
    start(async () => {
      const res = await quickUpdateAction(row.id, kind, trimmed === "" ? null : trimmed);
      if (!res.ok) {
        toast(res.error, "error");
        input.current?.focus();
        return;
      }
      const cents = trimmed === "" ? null : Math.round(parseFloat(trimmed.replace(",", ".").replace(/[€\s]/g, "")) * 100);
      onSaved(cents);
      setEditing(false);
      toast(kind === "price" ? `Prix enregistré : ${row.name}` : cents === null ? `Promotion retirée : ${row.name}` : `Promotion enregistrée : ${row.name}`);
    });
  };

  const label = kind === "price" ? "Prix" : "Prix promo";
  if (editing) {
    return (
      <span className="relative inline-flex items-center">
        <input
          ref={input}
          value={value}
          inputMode="decimal"
          aria-label={`${label} de ${row.name}`}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => !pending && save()}
          placeholder={kind === "promo" ? "vide = aucune" : ""}
          className="tabular h-9 w-24 rounded-md border-2 border-navy bg-white px-2 pr-6 text-right text-[0.9375rem] font-semibold focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2 text-sm text-ink-muted">€</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(centsToInput(current));
        setEditing(true);
      }}
      aria-label={`Modifier le ${label.toLowerCase()} de ${row.name}`}
      className={`tabular inline-flex h-9 min-w-24 items-center justify-end rounded-md border border-transparent px-2 text-[0.9375rem] hover:border-line-strong hover:bg-cream/50 ${
        kind === "promo" ? (current !== null ? "font-semibold text-coral-text" : "text-ink-faint") : "font-semibold text-ink"
      }`}
    >
      {current !== null ? formatPrice(current) : "—"}
      {kind === "price" && row.saleUnit === "KG" && <span className="ml-0.5 text-xs font-normal">/kg</span>}
    </button>
  );
}

function Toggle({ checked, onChange, label, on, off, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; on: string; off: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors ${
        checked ? "bg-success-bg text-green" : "bg-[#efece6] text-ink-muted"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${checked ? "bg-green" : "bg-ink-faint"}`} aria-hidden />
      {checked ? on : off}
    </button>
  );
}

export function ProductsTable({
  rows: initial,
  categories,
  total,
  canReorder,
  trash,
  savedId,
}: {
  rows: AdminRow[];
  categories: Cat[];
  total: number;
  canReorder: boolean;
  trash: boolean;
  savedId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reorder, setReorder] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [bulk, setBulk] = useState<"" | "promo">("");
  const [promoMode, setPromoMode] = useState<"percent" | "price">("percent");
  const [promoValue, setPromoValue] = useState("10");
  const [promoEnd, setPromoEnd] = useState("");

  useEffect(() => {
    if (savedId) toast("Produit enregistré");
  }, [savedId]);

  const patch = (id: string, p: Partial<AdminRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const quick = (row: AdminRow, f: "available" | "published" | "isNew" | "featured" | "categoryId", v: boolean | string) => {
    const before = row[f];
    patch(row.id, { [f]: v });
    start(async () => {
      const res = await quickUpdateAction(row.id, f, v);
      if (!res.ok) {
        patch(row.id, { [f]: before });
        toast(res.error, "error");
      } else toast("Enregistré");
    });
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runBulk = (op: BulkOp) =>
    start(async () => {
      const res = await bulkAction([...selected], op);
      if (!res.ok) return toast(res.error, "error");
      toast(res.message ?? "Modifié");
      setSelected(new Set());
      setBulk("");
      router.refresh();
    });

  const move = (id: string, delta: number) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      const j = i + delta;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const cols = "lg:grid-cols-[2rem_3rem_minmax(12rem,1fr)_8rem_7rem_7rem_minmax(14rem,auto)_7.5rem]";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="tabular text-sm text-ink-muted">
          {total} produit{total > 1 ? "s" : ""}
          {selected.size > 0 && <strong className="ml-2 text-ink">· {selected.size} sélectionné{selected.size > 1 ? "s" : ""}</strong>}
        </p>
        {canReorder && !trash && (
          <div className="flex gap-2">
            {reorder ? (
              <>
                <button className={`${btn.base} ${btn.secondary} ${btn.sm}`} onClick={() => { setRows(initial); setReorder(false); }}>Annuler</button>
                <button
                  className={`${btn.base} ${btn.primary} ${btn.sm}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await reorderProductsAction(rows.map((r) => r.id));
                      if (res.ok) {
                        toast(res.message ?? "Ordre enregistré");
                        setReorder(false);
                        router.refresh();
                      }
                    })
                  }
                >
                  Enregistrer l&apos;ordre
                </button>
              </>
            ) : (
              <button className={`${btn.base} ${btn.secondary} ${btn.sm}`} onClick={() => setReorder(true)}>Changer l&apos;ordre d&apos;affichage</button>
            )}
          </div>
        )}
        {!canReorder && !trash && <p className="text-xs text-ink-muted">Pour changer l&apos;ordre d&apos;affichage, filtrez d&apos;abord sur une catégorie.</p>}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
        <div className={`hidden border-b border-line bg-[#faf8f4] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted lg:grid lg:items-center lg:gap-3 ${cols}`}>
          <span>{!reorder && <input type="checkbox" className="h-4 w-4 accent-navy" checked={allSelected} onChange={toggleAll} aria-label="Tout sélectionner" />}</span>
          <span />
          <span>Produit</span>
          <span>Catégorie</span>
          <span className="text-right">Prix</span>
          <span className="text-right">Prix promo</span>
          <span>Statut</span>
          <span className="text-right">Actions</span>
        </div>
        {rows.length === 0 && <p className="p-8 text-center text-ink-muted">Aucun produit.</p>}
        <ul>
          {rows.map((r, i) => (
            <li
              key={r.id}
              draggable={reorder}
              onDragStart={() => setDragId(r.id)}
              onDragOver={(e) => {
                if (!reorder || !dragId || dragId === r.id) return;
                e.preventDefault();
                setRows((rs) => {
                  const from = rs.findIndex((x) => x.id === dragId);
                  const to = rs.findIndex((x) => x.id === r.id);
                  const copy = [...rs];
                  copy.splice(to, 0, copy.splice(from, 1)[0]);
                  return copy;
                });
              }}
              onDragEnd={() => setDragId(null)}
              className={`grid grid-cols-[auto_3.5rem_1fr] items-center gap-x-3 gap-y-2 border-b border-line px-3 py-3 last:border-b-0 lg:gap-3 lg:py-2 ${cols} ${selected.has(r.id) ? "bg-[#fff8e1]" : ""} ${dragId === r.id ? "opacity-50" : ""} ${savedId === r.id ? "bg-success-bg" : ""}`}
            >
              <span className="row-span-2 self-start pt-3 lg:row-span-1 lg:self-center lg:pt-0">
                {reorder ? (
                  <span className="flex flex-col items-center text-ink-muted">
                    <button type="button" onClick={() => move(r.id, -1)} aria-label={`Monter ${r.name}`} disabled={i === 0} className="disabled:opacity-30"><ChevronUp width={16} height={16} /></button>
                    <GripIcon width={16} height={16} className="cursor-grab" />
                    <button type="button" onClick={() => move(r.id, 1)} aria-label={`Descendre ${r.name}`} disabled={i === rows.length - 1} className="disabled:opacity-30"><ChevronDown width={16} height={16} /></button>
                  </span>
                ) : (
                  <input type="checkbox" className="h-5 w-5 accent-navy lg:h-4 lg:w-4" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Sélectionner ${r.name}`} />
                )}
              </span>
              <span className="row-span-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-line bg-white lg:row-span-1 lg:h-12 lg:w-12">
                {r.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(r.imageKey, 400)} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
                ) : (
                  <ImageIcon className="text-ink-faint" />
                )}
              </span>
              <span className="min-w-0">
                <Link href={`/admin/products/${r.id}`} className="block truncate font-semibold text-ink hover:underline">{r.name}</Link>
                <span className="block truncate text-xs text-ink-muted">
                  {[r.brand, r.reference && `Réf. ${r.reference}`].filter(Boolean).join(" · ") || "—"}
                  {r.isExample && <span className="ml-1 rounded border border-dashed border-ink-faint px-1">Exemple</span>}
                </span>
              </span>
              <span className="col-span-3 col-start-3 hidden lg:col-span-1 lg:col-start-auto lg:block">
                <select
                  aria-label={`Catégorie de ${r.name}`}
                  value={r.categoryId}
                  disabled={reorder || trash}
                  onChange={(e) => quick(r, "categoryId", e.target.value)}
                  className="h-9 w-full truncate rounded-md border border-line bg-white px-1 text-sm"
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </span>
              <span className="col-start-3 flex flex-wrap items-center gap-x-4 gap-y-1 lg:contents">
                <span className="flex items-center gap-1 lg:justify-end">
                  <span className="text-xs text-ink-muted lg:hidden">Prix</span>
                  <PriceCell row={r} kind="price" onSaved={(c) => patch(r.id, { priceCents: c! , promoCents: r.promoCents !== null && c! <= r.promoCents ? null : r.promoCents })} />
                </span>
                <span className="flex items-center gap-1 lg:justify-end">
                  <span className="text-xs text-ink-muted lg:hidden">Promo</span>
                  <PriceCell row={r} kind="promo" onSaved={(c) => patch(r.id, { promoCents: c })} />
                </span>
              </span>
              <span className="col-span-3 flex flex-wrap gap-1.5 lg:col-span-1">
                <Toggle checked={r.available} onChange={(v) => quick(r, "available", v)} label={`Disponibilité de ${r.name}`} on="Disponible" off="Indisponible" disabled={trash} />
                <Toggle checked={r.published} onChange={(v) => quick(r, "published", v)} label={`Publication de ${r.name}`} on="Publié" off="Brouillon" disabled={trash} />
                <Toggle checked={r.isNew} onChange={(v) => quick(r, "isNew", v)} label={`Nouveauté : ${r.name}`} on="Nouveau" off="Nouveau" disabled={trash} />
                <Toggle checked={r.featured} onChange={(v) => quick(r, "featured", v)} label={`Mise en avant : ${r.name}`} on="En avant" off="En avant" disabled={trash} />
              </span>
              <span className="col-span-3 flex justify-end gap-1 lg:col-span-1">
                {trash ? (
                  <button
                    type="button"
                    className={`${btn.base} ${btn.secondary} ${btn.sm}`}
                    onClick={() =>
                      start(async () => {
                        const res = await restoreDeletedAction(r.id);
                        if (!res.ok) return toast(res.error, "error");
                        toast("Produit restauré");
                        router.refresh();
                      })
                    }
                  >
                    Restaurer
                  </button>
                ) : (
                  <>
                    <Link href={`/admin/products/${r.id}`} className={`${btn.base} ${btn.secondary} ${btn.sm} px-3`}>Modifier</Link>
                    <details className="relative">
                      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg text-ink-muted hover:bg-cream" aria-label={`Plus d'actions pour ${r.name}`}>⋯</summary>
                      <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-line bg-white p-1 text-sm shadow-lg">
                        <form action={duplicateProductAction.bind(null, r.id)}>
                          <button className="w-full rounded px-3 py-2 text-left hover:bg-cream">Dupliquer</button>
                        </form>
                        <a href={`/produits/${r.slug}`} target="_blank" className="block rounded px-3 py-2 hover:bg-cream">Voir sur le site ↗</a>
                        <button
                          type="button"
                          className="w-full rounded px-3 py-2 text-left text-danger hover:bg-danger-bg"
                          onClick={() => {
                            if (!confirm(`Mettre « ${r.name} » à la corbeille ? Vous pourrez le restaurer.`)) return;
                            start(async () => {
                              const res = await deleteProductsAction([r.id]);
                              if (res.ok) {
                                toast(res.message ?? "Supprimé");
                                setRows((rs) => rs.filter((x) => x.id !== r.id));
                              }
                            });
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </details>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Barre d'actions groupées */}
      {selected.size > 0 && !trash && (
        <div className="sticky bottom-3 z-20 mt-4 rounded-[var(--radius-card)] bg-navy p-3 text-white shadow-xl sm:p-4">
          {bulk === "promo" ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                runBulk(promoMode === "percent" ? { kind: "promoPercent", percent: Number(promoValue.replace(",", ".")), endsAt: promoEnd || null } : { kind: "promoPrice", price: promoValue, endsAt: promoEnd || null });
              }}
            >
              <label className="text-sm">
                Type
                <select value={promoMode} onChange={(e) => setPromoMode(e.target.value as "percent" | "price")} className={`${field.input} text-ink`}>
                  <option value="percent">Remise en %</option>
                  <option value="price">Prix promo identique</option>
                </select>
              </label>
              <label className="text-sm">
                {promoMode === "percent" ? "Remise (%)" : "Prix promo (€)"}
                <input value={promoValue} onChange={(e) => setPromoValue(e.target.value)} inputMode="decimal" required className={`${field.input} w-28 text-ink`} />
              </label>
              <label className="text-sm">
                Jusqu&apos;au (facultatif)
                <input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} className={`${field.input} text-ink`} />
              </label>
              <button className={`${btn.base} ${btn.lg} bg-yellow text-navy hover:bg-[#ffd04d]`} disabled={pending}>Appliquer à {selected.size} produit{selected.size > 1 ? "s" : ""}</button>
              <button type="button" className="h-12 px-3 text-sm underline" onClick={() => setBulk("")}>Annuler</button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-semibold">{selected.size} sélectionné{selected.size > 1 ? "s" : ""} :</span>
              <button className="h-9 rounded-full bg-yellow px-3 text-sm font-semibold text-navy" onClick={() => setBulk("promo")}>Mettre en promotion</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "promoEnd" })}>Retirer la promo</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "available", value: true })}>Disponible</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "available", value: false })}>Indisponible</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "published", value: true })}>Publier</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "published", value: false })}>Dépublier</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "isNew", value: true })}>Nouveauté</button>
              <button className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold" onClick={() => runBulk({ kind: "featured", value: true })}>Mettre en avant</button>
              <select
                aria-label="Déplacer vers la catégorie"
                className="h-9 rounded-full bg-white/15 px-3 text-sm font-semibold text-white [&>option]:text-ink"
                value=""
                onChange={(e) => e.target.value && runBulk({ kind: "category", categoryId: e.target.value })}
              >
                <option value="">Changer de catégorie…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button
                className="h-9 rounded-full bg-danger px-3 text-sm font-semibold"
                onClick={() => {
                  if (!confirm(`Mettre ${selected.size} produit(s) à la corbeille ?`)) return;
                  start(async () => {
                    const res = await deleteProductsAction([...selected]);
                    if (res.ok) {
                      toast(res.message ?? "Supprimés");
                      setSelected(new Set());
                      router.refresh();
                    }
                  });
                }}
              >
                Supprimer
              </button>
              <button className="ml-auto h-9 px-2 text-sm underline" onClick={() => setSelected(new Set())}>Désélectionner</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
