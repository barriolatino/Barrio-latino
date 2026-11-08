import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getCountries } from "@/lib/catalogue";
import { flagEmoji } from "@/lib/format";
import { parseFilters } from "@/lib/filters";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCountries()).find((x) => x.slug === slug);
  return c ? { title: `Produits : ${c.name}`, alternates: { canonical: `/pays/${slug}` } } : {};
}

export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const country = (await getCountries()).find((c) => c.slug === slug);
  if (!country) notFound();
  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumbs items={[{ href: "/pays", label: "Pays" }, { label: country.name }]} />
      <PageTitle title={`${flagEmoji(country.isoCode)} ${country.name}`} />
      <ProductListing filters={parseFilters(sp)} fixed={{ pays: slug }} basePath={`/pays/${slug}`} searchParams={sp} />
    </div>
  );
}
