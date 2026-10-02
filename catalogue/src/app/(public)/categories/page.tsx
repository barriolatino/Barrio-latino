import type { Metadata } from "next";
import Link from "next/link";
import { CategoryCard } from "@/components/category-card";
import { PageTitle } from "@/components/ui";
import { getCategories } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Catégories", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const categories = (await getCategories()).filter((c) => c.count > 0);
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Catégories" intro="Choisissez un rayon pour voir tous ses produits." />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <li key={c.id}>
            <CategoryCard category={c} />
            {c.children.filter((s) => s.ownCount > 0).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {c.children.filter((s) => s.ownCount > 0).map((s) => (
                  <li key={s.id}>
                    <Link href={`/categories/${s.slug}`} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-sm text-ink-muted hover:border-navy hover:text-navy">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
