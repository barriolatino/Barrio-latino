"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CloseIcon, FilterIcon } from "./icons";
import { SORT_OPTIONS } from "@/lib/filters";

type Option = { value: string; label: string; count?: number };

export type FilterOptions = {
  categories: (Option & { children?: Option[] })[];
  countries: Option[];
  brands: Option[];
  hidden: string[]; // filtres imposés par la page (ex. la catégorie sur /categories/x)
};

const STORAGE: Option[] = [
  { value: "FROZEN", label: "Surgelé" },
  { value: "CHILLED", label: "Frais" },
  { value: "AMBIENT", label: "Épicerie" },
];

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const [pending, start] = useTransition();
  // L'interface reflète le choix immédiatement, sans attendre la réponse du serveur.
  const [optimistic, setOptimistic] = useOptimistic(urlParams.toString());
  const params = new URLSearchParams(optimistic);
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(optimistic);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    start(() => {
      setOptimistic(next.toString());
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  };
  return { params, set, pending };
}

export function SortSelect() {
  const { params, set } = useFilterNav();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-muted sm:inline">Trier par</span>
      <select
        value={params.get("tri") ?? "recommande"}
        onChange={(e) => set({ tri: e.target.value === "recommande" ? null : e.target.value })}
        className="h-10 rounded-full border border-line-strong bg-paper pl-3 pr-8 text-sm font-medium text-ink focus:border-navy"
        aria-label="Trier les produits"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterPanel({ options }: { options: FilterOptions }) {
  const { params, set } = useFilterNav();
  const show = (k: string) => !options.hidden.includes(k);
  const toggle = (k: string) => set({ [k]: params.get(k) === "1" ? null : "1" });
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  const group = "border-b border-line py-4 first:pt-0";
  const legend = "mb-2 text-sm font-semibold text-navy";
  const check = "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-1 text-[0.9375rem] hover:bg-cream/60";

  return (
    <div>
      <fieldset className={group}>
        <legend className={legend}>Afficher</legend>
        {show("promo") && (
          <label className={check}>
            <input type="checkbox" className="h-5 w-5 accent-navy" checked={params.get("promo") === "1"} onChange={() => toggle("promo")} />
            En promotion
          </label>
        )}
        {show("nouveau") && (
          <label className={check}>
            <input type="checkbox" className="h-5 w-5 accent-navy" checked={params.get("nouveau") === "1"} onChange={() => toggle("nouveau")} />
            Nouveautés
          </label>
        )}
        <label className={check}>
          <input type="checkbox" className="h-5 w-5 accent-navy" checked={params.get("dispo") === "1"} onChange={() => toggle("dispo")} />
          Disponibles uniquement
        </label>
      </fieldset>

      <fieldset className={group}>
        <legend className={legend}>Conservation</legend>
        <div className="flex flex-wrap gap-2">
          {STORAGE.map((o) => {
            const active = params.get("conservation") === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => set({ conservation: active ? null : o.value })}
                className={`h-9 rounded-full border px-3 text-sm font-medium ${active ? "border-navy bg-navy text-white" : "border-line-strong bg-paper text-ink hover:border-navy"}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {show("categorie") && options.categories.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Catégorie</legend>
          <select
            value={params.get("categorie") ?? ""}
            onChange={(e) => set({ categorie: e.target.value || null })}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-[0.9375rem]"
            aria-label="Catégorie"
          >
            <option value="">Toutes les catégories</option>
            {options.categories.map((c) => [
              <option key={c.value} value={c.value}>
                {c.label} ({c.count})
              </option>,
              ...(c.children ?? []).map((s) => (
                <option key={s.value} value={s.value}>
                  {"   "}
                  {s.label} ({s.count})
                </option>
              )),
            ])}
          </select>
        </fieldset>
      )}

      {show("pays") && options.countries.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Pays</legend>
          <select
            value={params.get("pays") ?? ""}
            onChange={(e) => set({ pays: e.target.value || null })}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-[0.9375rem]"
            aria-label="Pays"
          >
            <option value="">Tous les pays</option>
            {options.countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>
        </fieldset>
      )}

      {show("marque") && options.brands.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Marque</legend>
          <select
            value={params.get("marque") ?? ""}
            onChange={(e) => set({ marque: e.target.value || null })}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-[0.9375rem]"
            aria-label="Marque"
          >
            <option value="">Toutes les marques</option>
            {options.brands.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label} ({b.count})
              </option>
            ))}
          </select>
        </fieldset>
      )}

      <fieldset className={`${group} border-b-0`}>
        <legend className={legend}>Prix (€)</legend>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ min: min || null, max: max || null });
          }}
        >
          <label className="flex-1 text-xs text-ink-muted">
            Min
            <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className="mt-1 h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-2 text-[0.9375rem] text-ink" />
          </label>
          <label className="flex-1 text-xs text-ink-muted">
            Max
            <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="50" className="mt-1 h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-2 text-[0.9375rem] text-ink" />
          </label>
          <button type="submit" className="h-10 rounded-full bg-navy px-3 text-sm font-semibold text-white">
            OK
          </button>
        </form>
      </fieldset>
    </div>
  );
}

const LABEL_KEYS = ["q", "promo", "nouveau", "dispo", "conservation", "categorie", "pays", "marque", "min", "max"] as const;

export function ActiveFilters({ options }: { options: FilterOptions }) {
  const { params, set } = useFilterNav();
  const label = (k: string, v: string) => {
    switch (k) {
      case "q": return `« ${v} »`;
      case "promo": return "En promotion";
      case "nouveau": return "Nouveautés";
      case "dispo": return "Disponibles";
      case "conservation": return STORAGE.find((s) => s.value === v)?.label ?? v;
      case "categorie": return options.categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.value === v)?.label ?? v;
      case "pays": return options.countries.find((c) => c.value === v)?.label ?? v;
      case "marque": return options.brands.find((c) => c.value === v)?.label ?? v;
      case "min": return `Dès ${v} €`;
      case "max": return `Jusqu'à ${v} €`;
      default: return v;
    }
  };
  const active = LABEL_KEYS.filter((k) => params.get(k) && !options.hidden.includes(k));
  if (!active.length) return null;
  return (
    <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtres actifs">
      {active.map((k) => (
        <li key={k}>
          <button type="button" onClick={() => set({ [k]: null })} className="inline-flex h-8 items-center gap-1 rounded-full bg-cream-deep px-3 text-sm font-medium text-navy hover:bg-line-strong" aria-label={`Retirer le filtre ${label(k, params.get(k)!)}`}>
            {label(k, params.get(k)!)}
            <CloseIcon width={14} height={14} />
          </button>
        </li>
      ))}
      {active.length > 1 && (
        <li>
          <button type="button" onClick={() => set(Object.fromEntries(active.map((k) => [k, null])))} className="h-8 px-2 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-navy">
            Tout effacer
          </button>
        </li>
      )}
    </ul>
  );
}

export function FiltersSidebar({ options }: { options: FilterOptions }) {
  return (
    <aside className="hidden lg:block" aria-label="Filtres">
      <div className="sticky top-24">
        <FilterPanel options={options} />
      </div>
    </aside>
  );
}

export function FiltersDrawerButton({ options, total }: { options: FilterOptions; total: number }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { params, pending } = useFilterNav();
  const activeCount = LABEL_KEYS.filter((k) => k !== "q" && params.get(k) && !options.hidden.includes(k)).length;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-paper px-4 text-sm font-semibold text-navy lg:hidden">
        <FilterIcon width={18} height={18} />
        Filtres
        {activeCount > 0 && <span className="tabular rounded-full bg-navy px-1.5 text-xs leading-5 text-white">{activeCount}</span>}
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)} className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-2xl bg-paper p-0 backdrop:bg-navy/40" aria-label="Filtres">
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-xl font-bold text-navy">Filtres</span>
            <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream" aria-label="Fermer les filtres">
              <CloseIcon width={24} height={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {open && <FilterPanel options={options} />}
          </div>
          <div className="border-t border-line p-4">
            <button type="button" onClick={() => setOpen(false)} className="h-12 w-full rounded-full bg-navy font-semibold text-white">
              {pending ? "Mise à jour…" : `Voir ${total} produit${total > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
