import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getCategories } from "@/lib/catalogue";
import { parseFilters } from "@/lib/filters";

async function findCategory(slug: string) {
  const roots = await getCategories();
  for (const c of roots) {
    if (c.slug === slug) return { category: c, parent: null, children: c.children };
    const child = c.children.find((s) => s.slug === slug);
    if (child) return { category: child, parent: c, children: [] };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await findCategory((await params).slug);
  if (!found) return {};
  return {
    title: found.category.name,
    description: found.category.description ?? `${found.category.name} : tous nos produits, avec photos, formats et prix.`,
    alternates: { canonical: `/categories/${found.category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = await findCategory(slug);
  if (!found) notFound();
  const { category, parent, children } = found;
  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumbs
        items={[
          { href: "/catalogue", label: "Catalogue" },
          ...(parent ? [{ href: `/categories/${parent.slug}`, label: parent.name }] : []),
          { label: category.name },
        ]}
      />
      <PageTitle title={category.name} intro={category.description}>
        {children.some((c) => c.ownCount > 0) && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {children.filter((c) => c.ownCount > 0).map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:border-navy">
                  {c.name} <span className="tabular text-ink-faint">{c.ownCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageTitle>
      <ProductListing filters={parseFilters(sp)} fixed={{ categorie: slug }} basePath={`/categories/${slug}`} searchParams={sp} />
    </div>
  );
}
