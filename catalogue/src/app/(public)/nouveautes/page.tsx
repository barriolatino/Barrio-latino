import type { Metadata } from "next";
import { ProductListing } from "@/components/product-listing";
import { PageTitle } from "@/components/ui";
import { parseFilters } from "@/lib/filters";

export const metadata: Metadata = { title: "Nouveautés", description: "Les derniers produits arrivés à l'épicerie.", alternates: { canonical: "/nouveautes" } };

export default async function NouveautesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Nouveautés" intro="Les derniers arrivages." />
      <ProductListing filters={{ tri: "nouveautes", ...filters }} fixed={{ nouveau: true }} basePath="/nouveautes" searchParams={sp} />
    </div>
  );
}
