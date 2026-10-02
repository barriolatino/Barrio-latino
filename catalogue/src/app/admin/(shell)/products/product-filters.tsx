"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { field } from "@/components/admin/ui";

const STATUTS = [
  ["", "Tous les produits"],
  ["disponible", "Disponibles"],
  ["indisponible", "Indisponibles"],
  ["brouillon", "Brouillons (non publiés)"],
  ["promo", "En promotion"],
  ["nouveau", "Nouveautés"],
  ["vedette", "Mis en avant"],
  ["sans-photo", "Sans photo"],
  ["exemples", "Exemples (démonstration)"],
  ["corbeille", "Corbeille"],
];

export function ProductFilters({ categories }: { categories: { id: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete("page");
    next.delete("saved");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
      <label className="sr-only" htmlFor="admin-q">Rechercher</label>
      <input
        id="admin-q"
        type="search"
        value={q}
        placeholder="Rechercher : nom, marque, référence…"
        className={`${field.input} col-span-2 mt-0 lg:col-span-1`}
        onChange={(e) => {
          setQ(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(() => set("q", v), 250);
        }}
      />
      <select aria-label="Catégorie" className={`${field.input} mt-0`} value={params.get("categorie") ?? ""} onChange={(e) => set("categorie", e.target.value)}>
        <option value="">Toutes les catégories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select aria-label="Statut" className={`${field.input} mt-0`} value={params.get("statut") ?? ""} onChange={(e) => set("statut", e.target.value)}>
        {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select aria-label="Tri" className={`${field.input} col-span-2 mt-0 sm:col-span-1 lg:col-span-1`} value={params.get("tri") ?? ""} onChange={(e) => set("tri", e.target.value)}>
        <option value="">Ordre d&apos;affichage</option>
        <option value="nom">Nom</option>
        <option value="prix">Prix</option>
        <option value="maj">Dernières modifiées</option>
      </select>
    </div>
  );
}
