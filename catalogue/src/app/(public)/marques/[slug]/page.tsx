import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getBrands } from "@/lib/catalogue";
import { parseFilters } from "@/lib/filters";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = (await getBrands()).find((x) => x.slug === slug);
  return b ? { title: `Marque ${b.name}`, alternates: { canonical: `/marques/${slug}` } } : {};
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = (await getBrands()).find((b) => b.slug === slug);
  if (!brand) notFound();
  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumbs items={[{ href: "/catalogue", label: "Catalogue" }, { label: brand.name }]} />
      <PageTitle title={brand.name} />
      <ProductListing filters={parseFilters(sp)} fixed={{ marque: slug }} basePath={`/marques/${slug}`} searchParams={sp} />
    </div>
  );
}
