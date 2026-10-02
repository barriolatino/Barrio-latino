import type { Metadata } from "next";
import { ProductListing } from "@/components/product-listing";
import { PageTitle } from "@/components/ui";
import { parseFilters } from "@/lib/filters";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Tous nos produits latino-américains : photos, formats et prix. Recherche par nom, marque, pays ou référence.",
  alternates: { canonical: "/catalogue" },
};

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Catalogue" />
      <ProductListing filters={parseFilters(sp)} basePath="/catalogue" searchParams={sp} />
    </div>
  );
}
