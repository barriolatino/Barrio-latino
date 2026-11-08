import Link from "next/link";
import { Suspense } from "react";
import { getBrands, getCategories, getCountries, getSettings, listProducts, PAGE_SIZE, type ProductFilters } from "@/lib/catalogue";
import { ActiveFilters, FiltersDrawerButton, FiltersSidebar, SortSelect, type FilterOptions } from "./catalogue-filters";
import { ProductCard, ProductGrid } from "./product-card";
import { EmptyState, btn } from "./ui";

/** Liste filtrable partagée par le catalogue, les catégories, les pays, les promotions… */
export async function ProductListing({
  filters,
  fixed = {},
  basePath,
  searchParams,
}: {
  filters: ProductFilters;
  fixed?: ProductFilters;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const merged = { ...filters, ...fixed };
  const [settings, result, categories, countries, brands] = await Promise.all([
    getSettings(),
    listProducts(merged),
    getCategories(),
    getCountries(),
    getBrands(),
  ]);
  const options: FilterOptions = {
    categories: categories
      .filter((c) => c.count > 0)
      .map((c) => ({
        value: c.slug,
        label: c.name,
        count: c.count,
        children: c.children.filter((s) => s.ownCount > 0).map((s) => ({ value: s.slug, label: s.name, count: s.ownCount })),
      })),
    countries: countries.map((c) => ({ value: c.slug, label: c.name, count: c.count })),
    brands: brands.map((b) => ({ value: b.slug, label: b.name, count: b.count })),
    hidden: Object.entries(fixed)
      .filter(([, v]) => v !== undefined && v !== false)
      .map(([k]) => k),
  };
  const page = filters.page ?? 1;
  const shown = result.items.length;
  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") nextParams.set(k, v);
  nextParams.set("page", String(page + 1));

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
      <Suspense>
        <FiltersSidebar options={options} />
      </Suspense>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm text-ink-muted" aria-live="polite">
            <strong className="font-semibold text-ink">{result.total}</strong> produit{result.total > 1 ? "s" : ""}
            {result.approximate && " (résultats approchants)"}
          </p>
          <div className="flex items-center gap-2">
            <Suspense>
              <FiltersDrawerButton options={options} total={result.total} />
              <SortSelect />
            </Suspense>
          </div>
        </div>
        <Suspense>
          <ActiveFilters options={options} />
        </Suspense>
        {result.items.length === 0 ? (
          <EmptyState title="Aucun produit ne correspond">
            <p>Essayez un autre mot, ou retirez un filtre.</p>
            <Link href={basePath} className={`${btn.base} ${btn.secondary} ${btn.md} mt-4`}>
              Réinitialiser
            </Link>
          </EmptyState>
        ) : (
          <>
            <ProductGrid>
              {result.items.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={settings.currency} showReference={settings.showReferences} priority={i < 4} />
              ))}
            </ProductGrid>
            {shown < result.total && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <p className="tabular text-sm text-ink-muted">
                  {shown} sur {result.total}
                </p>
                <Link href={`${basePath}?${nextParams}`} scroll={false} className={`${btn.base} ${btn.secondary} ${btn.lg}`}>
                  Voir {Math.min(PAGE_SIZE, result.total - shown)} produits de plus
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
