import type { ProductFilters } from "./catalogue";
import { parsePrice } from "./format";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Lit les filtres depuis l'URL : /catalogue?q=arepa&pays=colombie&promo=1&tri=prix-asc */
export function parseFilters(sp: SP): ProductFilters {
  const min = parsePrice(one(sp.min) ?? null);
  const max = parsePrice(one(sp.max) ?? null);
  const page = Number(one(sp.page));
  return {
    q: one(sp.q)?.slice(0, 80),
    categorie: one(sp.categorie),
    pays: one(sp.pays),
    marque: one(sp.marque),
    conservation: one(sp.conservation),
    promo: one(sp.promo) === "1",
    nouveau: one(sp.nouveau) === "1",
    dispo: one(sp.dispo) === "1",
    min: min ?? undefined,
    max: max ?? undefined,
    tri: one(sp.tri),
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 50) : 1,
  };
}

export const SORT_OPTIONS = [
  { value: "recommande", label: "Recommandé" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
  { value: "nom-asc", label: "Nom A → Z" },
  { value: "nom-desc", label: "Nom Z → A" },
  { value: "nouveautes", label: "Nouveautés d'abord" },
] as const;
